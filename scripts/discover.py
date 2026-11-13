"""Public postings only. No candidate PII, paid services, or application submission."""
import concurrent.futures
import datetime as dt
import hashlib
import html
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', value or ''))).strip()

def safe_url(url):
    from urllib.parse import urlparse
    return url if isinstance(url, str) and urlparse(url).scheme == 'https' else ''

def score(job, profile):
    text = (job['title'] + ' ' + job['description']).lower()
    business_analysis = bool(re.search(r'\bbusiness(?:\s+systems|\s+process|\s+technology)?\s+analyst\b', job['title'], re.I))
    weights = profile.get('tracks', {}).get('business_analysis', {}).get('skills', profile['skills']) if business_analysis else profile['skills']
    matched = [s for s in weights if re.search(r'(?<![a-z])' + re.escape(s) + r'(?![a-z])', text)]
    points = sum(weights[s] for s in matched)
    role = business_analysis or bool(re.search(r'backend|back.end|software|java|platform engineer', job['title'], re.I))
    senior = bool(re.search(r'\bstaff\b|\bprincipal\b|\bdirector\b|\bmanager\b', job['title'], re.I))
    # Heuristic, not an LLM assessment or eligibility determination.
    value = min(100, round(75 * points / sum(weights.values())) + (25 if role else 0))
    if senior:
        value = max(0, value - 25)
    return value, matched

def fetch(source):
    board, kind = source['board'], source['type']
    url = (f'https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true' if kind == 'greenhouse' else f'https://api.lever.co/v0/postings/{board}?mode=json')
    data = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'JobGetter/1.0 (public job feed reader)'})
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.load(response)
            break
        except urllib.error.HTTPError as exc:
            if exc.code not in (429,500,502,503,504) or attempt == 2:
                raise
            retry = exc.headers.get('Retry-After','')
            time.sleep(min(30, int(retry) if retry.isdigit() else 2 ** (attempt+1)))
    jobs = []
    for raw in data['jobs'] if kind == 'greenhouse' else data:
        if not isinstance(raw, dict) or not raw.get('id'):
            continue
        title = raw.get('title', raw.get('text',''))
        if not isinstance(title, str):
            continue
        if not re.search(r'software|backend|back.end|java|full.stack|platform engineer|developer|\bbusiness(?:\s+systems|\s+process|\s+technology)?\s+analyst\b', title, re.I):
            continue
        if kind == 'greenhouse':
            desc = plain(raw.get('content',''))
            location = (raw.get('location') or {}).get('name') or 'Unknown'
            link = raw.get('absolute_url','')
        else:
            desc = plain(raw.get('descriptionPlain', raw.get('description','')))
            desc += ' ' + ' '.join(plain(x.get('text','')+' '+x.get('content','')) for x in (raw.get('lists') or []))
            location = (raw.get('categories') or {}).get('location') or 'Unknown'
            link = raw.get('hostedUrl','')
        if not safe_url(link):
            continue
        truncated = len(desc) > 25000
        desc = desc[:25000]
        jobs.append({'id':f'{kind}:{board}:{raw["id"]}', 'company':board, 'title':title, 'location':location, 'url':link, 'description':desc, 'description_truncated':truncated, 'source':kind, 'content_hash':hashlib.sha256(desc.encode()).hexdigest()})
    return jobs

def run():
    path = ROOT/'docs/data/jobs.json'
    old = json.loads(path.read_text()) if path.exists() else {'jobs':[]}
    existing = {j['id']:j for j in old['jobs']}
    profile = json.loads((ROOT/'profile.json').read_text())
    sources = json.loads((ROOT/'sources.json').read_text())
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    jobs, errors, successful = [], [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(fetch,s):s for s in sources}
        for future in concurrent.futures.as_completed(futures):
            source = futures[future]
            try:
                result = future.result()
                successful.append(source['type']+':'+source['board'])
                for job in result:
                    job['score'],job['matched_skills'] = score(job,profile)
                    job['first_seen'] = existing.get(job['id'],{}).get('first_seen',now)
                    job['last_seen'] = now
                    job['stale'] = False
                    jobs.append(job)
            except Exception as exc:
                errors.append({'source':source['type']+':'+source['board'],'error':type(exc).__name__})
    # Retain a failed source's previous records explicitly marked stale.
    failed = {e['source'] for e in errors}
    for oldjob in existing.values():
        key = ':'.join(oldjob['id'].split(':')[:2])
        if key in failed:
            jobs.append({**oldjob,'stale':True})
    if not successful:
        raise RuntimeError('All sources failed; previous data preserved')
    jobs = list({j['id']:j for j in jobs}.values())
    jobs.sort(key=lambda j:(-j['score'],j['id']))
    output = {'updated_at':now,'scoring':'Keyword heuristic; not AI. Eligibility unverified.', 'sources_ok':successful,'errors':errors,'jobs':jobs}
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(output,ensure_ascii=False))
    temporary.replace(path)
    print(f'{len(jobs)} jobs; {len(successful)} sources succeeded; {len(errors)} source errors')

if __name__ == '__main__':
    run()
