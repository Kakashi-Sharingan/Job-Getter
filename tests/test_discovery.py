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
