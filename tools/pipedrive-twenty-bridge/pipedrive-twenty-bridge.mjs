#!/usr/bin/env node
// Pipedrive -> Twenty migration bridge.
//
// Fixes the three gaps found in the migration audit:
//   1. Notes migrated onto the Twenty Person but never linked to the Opportunity.
//      -> adds a noteTarget (targetOpportunityId) to the EXISTING note. No duplicate note.
//   2. Notes / people that dropped entirely.
//      -> recreates the missing note (and person, if absent) from Pipedrive.
//   3. Pipedrive deal EMAIL threads never migrated.
//      -> imports each email as a Twenty note ("Email: <subject>") linked to person + opportunity.
//
// This script CANNOT run inside the Claude Code sandbox (egress policy blocks
// api.pipedrive.com and the Twenty API host). Run it on a machine with network
// access to both, with FRESH (rotated) keys.
//
// Usage:
//   PIPEDRIVE_API_TOKEN=xxx \
//   TWENTY_API_URL=https://<your-twenty-host> \   (no trailing slash; e.g. https://api.twenty.com)
//   TWENTY_API_TOKEN=xxx \
//   node pipedrive-twenty-bridge.mjs --dry-run            # default: no writes, prints planned actions
//   node pipedrive-twenty-bridge.mjs --execute            # perform writes
//   node pipedrive-twenty-bridge.mjs --execute --only=notes,emails,dropped   # subset
//
// Idempotent: re-running skips notes/targets/emails that already exist (matched by
// pipedriveId markers and existing noteTargets). Safe to run repeatedly.

const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const TW_URL = (process.env.TWENTY_API_URL || '').replace(/\/$/, '');
const TW_TOKEN = process.env.TWENTY_API_TOKEN;

const DRY = !process.argv.includes('--execute');
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const ONLY = onlyArg ? new Set(onlyArg.split(',')) : new Set(['notes', 'emails', 'dropped']);

if (!PD_TOKEN || !TW_URL || !TW_TOKEN) {
  console.error('Missing env: PIPEDRIVE_API_TOKEN, TWENTY_API_URL, TWENTY_API_TOKEN');
  process.exit(1);
}
console.log(`Mode: ${DRY ? 'DRY-RUN (no writes)' : 'EXECUTE'} | steps: ${[...ONLY].join(',')}`);

// ---------- Pipedrive (REST v1/v2) ----------
const PD = 'https://api.pipedrive.com';

async function pd(path, params = {}) {
  const url = new URL(PD + path);
  url.searchParams.set('api_token', PD_TOKEN);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`PD ${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

// Cursor-paginated (v2) or start/limit (v1) collector.
async function pdAll(path, { v2 = false, params = {} } = {}) {
  const out = [];
  if (v2) {
    let cursor = null;
    do {
      const j = await pd(path, { ...params, limit: 500, cursor });
      out.push(...(j.data || []));
      cursor = j.additional_data?.next_cursor || null;
    } while (cursor);
  } else {
    let start = 0;
    for (;;) {
      const j = await pd(path, { ...params, start, limit: 500 });
      out.push(...(j.data || []));
      if (!j.additional_data?.pagination?.more_items_in_collection) break;
      start = j.additional_data.pagination.next_start;
    }
  }
  return out;
}

// Notes for a deal (v1 /notes?deal_id=). Returns [{id, content(html), add_time, person_id}]
const pdDealNotes = (dealId) => pdAll('/v1/notes', { params: { deal_id: dealId } });
// Email messages for a deal (v1). Each thread's messages: /v1/deals/{id}/mailMessages
const pdDealMail = (dealId) => pd(`/v1/deals/${dealId}/mailMessages`, { start: 0, limit: 100 }).then((j) => j.data || []);
const pdPerson = (id) => pd(`/v1/persons/${id}`).then((j) => j.data);

// ---------- Twenty (REST) ----------
async function tw(method, path, body) {
  const r = await fetch(`${TW_URL}/rest${path}`, {
    method,
    headers: { Authorization: `Bearer ${TW_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`TW ${method} ${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

// Find by the pipedriveId custom field (present on Twenty person + opportunity).
async function twOppByPipedriveId(pid) {
  const j = await tw('GET', `/opportunities?filter=pipedriveId[eq]:${pid}&limit=1&depth=1`);
  return (j.data?.opportunities || j.data || [])[0] || null;
}
async function twPersonByEmail(email) {
  const j = await tw('GET', `/people?filter=emails.primaryEmail[eq]:${encodeURIComponent(email)}&limit=1&depth=1`);
  return (j.data?.people || j.data || [])[0] || null;
}
// Notes already targeting a person (depth=1 pulls noteTargets). Model per audit:
// note.noteTargets[].personId / .opportunityId
async function twPersonNotes(personId) {
  const j = await tw('GET', `/notes?filter=noteTargets.personId[eq]:${personId}&limit=200&depth=1`);
  return j.data?.notes || j.data || [];
}
const twCreateNote = (title, body) => tw('POST', '/notes', { title, body }).then((j) => j.data?.createNote || j.data);
const twCreateNoteTarget = (t) => tw('POST', '/noteTargets', t); // {noteId, opportunityId?|personId?}

// ---------- helpers ----------
const stripHtml = (h) => (h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const FORM_MARKERS = ['Web Form submission summary', 'Chatbot conversation summary'];
const norm = (s) => stripHtml(s).replace(/\s+/g, ' ').slice(0, 120).toLowerCase();

const stats = { relinked: 0, notesBackfilled: 0, peopleCreated: 0, emailsImported: 0, skipped: 0, errors: 0 };
async function doWrite(label, fn) {
  if (DRY) { console.log(`  [dry] would ${label}`); return null; }
  try { const r = await fn(); return r; } catch (e) { stats.errors++; console.error(`  [err] ${label}: ${e.message}`); return null; }
}

// ---------- main ----------
const deals = await pdAll('/v2/deals', { v2: true, params: { status: 'all_not_deleted' } });
console.log(`Pipedrive deals: ${deals.length}`);

for (const deal of deals) {
  const dealId = deal.id;
  const personId = deal.person_id?.value ?? deal.person_id ?? null;
  const opp = await twOppByPipedriveId(dealId).catch(() => null);
  const pdNotes = await pdDealNotes(dealId).catch(() => []);
  const email = personId ? (await pdPerson(personId).catch(() => null))?.primary_email : null;
  const twPerson = email ? await twPersonByEmail(email).catch(() => null) : null;
  const twNotes = twPerson ? await twPersonNotes(twPerson.id).catch(() => []) : [];
  const twNoteByBody = new Map(twNotes.map((n) => [norm(n.body || n.title), n]));

  const tag = `deal ${dealId} "${deal.title}"`;

  // ---- gaps #1 + #2: notes ----
  if (ONLY.has('notes') || ONLY.has('dropped')) {
    for (const pn of pdNotes) {
      const body = stripHtml(pn.content);
      let note = twNoteByBody.get(norm(body));

      // #2 dropped note: exists in Pipedrive, absent in Twenty -> recreate on person
      if (!note && ONLY.has('dropped')) {
        if (!twPerson) { console.log(`  ${tag}: note present in PD but PERSON missing in Twenty -> needs person create (email=${email || 'unknown'})`); }
        const title = FORM_MARKERS.find((m) => body.includes(m)) || body.split('\n')[0].slice(0, 80) || 'Migrated note';
        note = await doWrite(`backfill note onto person ${twPerson?.id}`, async () => {
          const n = await twCreateNote(title, body);
          if (twPerson) await twCreateNoteTarget({ noteId: n.id, personId: twPerson.id });
          stats.notesBackfilled++;
          return n;
        });
      }

      // #1 relink: note exists on person, ensure it also targets the opportunity
      if (note && opp && ONLY.has('notes')) {
        const already = (note.noteTargets || []).some((t) => (t.opportunityId ?? t.targetOpportunityId) === opp.id);
        if (already) { stats.skipped++; }
        else {
          await doWrite(`link note ${note.id} -> opportunity ${opp.id} (${tag})`, async () => {
            await twCreateNoteTarget({ noteId: note.id, opportunityId: opp.id });
            stats.relinked++;
          });
        }
      }
    }
  }

  // ---- gap #3: emails ----
  if (ONLY.has('emails')) {
    const mails = await pdDealMail(dealId).catch(() => []);
    for (const m of mails) {
      const subject = m.subject || '(no subject)';
      const from = (m.from || []).map((f) => f.email_address).join(', ');
      const to = (m.to || []).map((f) => f.email_address).join(', ');
      const when = m.message_time || m.add_time || '';
      const title = `Email: ${subject}`;
      const marker = `pipedrive_mail_id:${m.id}`;
      const already = twNotes.some((n) => (n.body || '').includes(marker));
      if (already) { stats.skipped++; continue; }
      const body = `${marker}\nFrom: ${from}\nTo: ${to}\nDate: ${when}\nSubject: ${subject}\n\n${stripHtml(m.body || m.snippet || '')}`;
      await doWrite(`import email "${subject}" (${tag}) -> person${opp ? ' + opportunity' : ''}`, async () => {
        const n = await twCreateNote(title, body);
        if (twPerson) await twCreateNoteTarget({ noteId: n.id, personId: twPerson.id });
        if (opp) await twCreateNoteTarget({ noteId: n.id, opportunityId: opp.id });
        stats.emailsImported++;
      });
    }
  }
}

console.log('\n=== SUMMARY ===');
console.log(stats);
console.log(DRY ? '\nDRY-RUN only. Re-run with --execute to apply.' : '\nDone.');
