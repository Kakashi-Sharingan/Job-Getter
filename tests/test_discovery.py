import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('discover',Path(__file__).resolve().parents[1]/'scripts/discover.py')
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
class DiscoveryTests(unittest.TestCase):
    def test_java_is_not_javascript(self):
        score,skills=m.score({'title':'Software Engineer','description':'JavaScript only'}, {'skills':{'java':5}})
        self.assertEqual(skills,[])
        self.assertEqual(score,25)
    def test_html_and_unsafe_urls(self):
        self.assertEqual(m.plain('<p>Java &amp; SQL</p>'),'Java & SQL')
        self.assertEqual(m.safe_url('javascript:alert(1)'),'')
    def test_seniority_penalty(self):
        p={'skills':{'java':5}}
        self.assertLess(m.score({'title':'Staff Software Engineer','description':'Java'},p)[0],m.score({'title':'Software Engineer','description':'Java'},p)[0])
    def test_long_description_hash_matches_the_stored_snapshot(self):
        from unittest.mock import patch
        import io, json, hashlib
        posting={'jobs':[{'id':1,'title':'Java Engineer','content':'Java '+('x'*26000),'location':None,'absolute_url':'https://example.com/job/1'}]}
        with patch.object(m.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps(posting).encode())):
            jobs=m.fetch({'type':'greenhouse','board':'example'})
        self.assertEqual(jobs[0]['location'],'Unknown')
        self.assertTrue(jobs[0]['description_truncated'])
        self.assertEqual(jobs[0]['content_hash'],hashlib.sha256(jobs[0]['description'].encode()).hexdigest())
    def test_optional_lever_fields_do_not_fail_the_source(self):
        from unittest.mock import patch
        import io,json
        postings=[{'id':'1','text':'Java Engineer','description':'Java','categories':None,'lists':None,'hostedUrl':'https://example.com/job/1'},{'id':'2','text':None},None]
        with patch.object(m.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps(postings).encode())):
            jobs=m.fetch({'type':'lever','board':'example'})
        self.assertEqual(len(jobs),1)
        self.assertEqual(jobs[0]['location'],'Unknown')
