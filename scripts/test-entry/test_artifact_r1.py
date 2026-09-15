import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile
import package_artifact as a

C,E='a'*40,'b'*40
class ArtifactR1(unittest.TestCase):
    def source(self,r):
        s=r/'src';(s/'.output/server').mkdir(parents=True);(s/'.output/public/empty').mkdir(parents=True)
        (s/'.output/server/index.mjs').write_text('export default {};')
        (s/'.output/public/executable').write_text('fixture');os.chmod(s/'.output/public/executable',0o755)
        return s
    def malicious(self,r,members):
        bundle=r/'bundle';bundle.mkdir()
        with zipfile.ZipFile(bundle/'payload.zip','w') as z:
            for name,mode in members:
                zi=zipfile.ZipInfo(name);zi.create_system=3;zi.external_attr=mode<<16
                z.writestr(zi,'' if stat.S_ISDIR(mode) else 'fixture')
        (bundle/'manifest.json').write_text(json.dumps({'candidate_sha':C,'entry_sha':E,'payload_sha256':a.digest(bundle/'payload.zip')}))
        return bundle,a.digest(bundle/'manifest.json')
    def base(self):
        return [('.output/',stat.S_IFDIR|0o755),('.output/server/',stat.S_IFDIR|0o755),('.output/public/',stat.S_IFDIR|0o755),('.output/server/index.mjs',stat.S_IFREG|0o644)]
    def test_modes_and_empty_directories_roundtrip(self):
        with tempfile.TemporaryDirectory() as t:
            r=Path(t);s=self.source(r);d=a.pack(s,r/'b',C,E);a.unpack(r/'b',r/'out',d,C,E)
            self.assertEqual(a.inventory(s),a.inventory(r/'out'))
    def test_invalid_zip_paths_and_types(self):
        cases=[('/tmp/escape',stat.S_IFREG|0o644),('.output/../escape',stat.S_IFREG|0o644),('.output\\escape',stat.S_IFREG|0o644),('.output/C:escape',stat.S_IFREG|0o644),('.output/link',stat.S_IFLNK|0o777),('.output/fifo',stat.S_IFIFO|0o600),('.output/device',stat.S_IFCHR|0o600),('.output/setuid',stat.S_IFREG|0o4644),('.output/server/index.mjs',stat.S_IFREG|0o644)]
        for name,mode in cases:
            with self.subTest(name=name),tempfile.TemporaryDirectory() as t:
                r=Path(t);b,d=self.malicious(r,self.base()+[(name,mode)])
                with self.assertRaises(a.ArtifactError):a.unpack(b,r/'out',d,C,E)
                self.assertFalse((r/'out').exists())
    def test_raw_zip_null_name(self):
        with tempfile.TemporaryDirectory() as t:
            r=Path(t);b,d=self.malicious(r,self.base()+[('.output/x_y',stat.S_IFREG|0o644)])
            f=b/'payload.zip';f.write_bytes(f.read_bytes().replace(b'.output/x_y',b'.output/x\x00y'))
            m=json.loads((b/'manifest.json').read_text());m['payload_sha256']=a.digest(f)
            (b/'manifest.json').write_text(json.dumps(m));d=a.digest(b/'manifest.json')
            with self.assertRaises(a.ArtifactError):a.unpack(b,r/'out',d,C,E)
            self.assertFalse((r/'out').exists())

    def test_missing_entry_or_assets(self):
        for omitted in ['.output/server/index.mjs','.output/public/']:
            with tempfile.TemporaryDirectory() as t:
                r=Path(t);b,d=self.malicious(r,[x for x in self.base() if x[0]!=omitted])
                with self.assertRaises(a.ArtifactError):a.unpack(b,r/'out',d,C,E)
                self.assertFalse((r/'out').exists())
    def test_manifest_schema_and_duplicate_keys(self):
        for text in ['[]','{}','{"candidate_sha":"a","candidate_sha":"b"}']:
            with tempfile.TemporaryDirectory() as t:
                r=Path(t);s=self.source(r);a.pack(s,r/'b',C,E);(r/'b/manifest.json').write_text(text)
                with self.assertRaises(a.ArtifactError):a.unpack(r/'b',r/'out',a.digest(r/'b/manifest.json'),C,E)
                self.assertFalse((r/'out').exists())
    def test_existing_output_not_touched(self):
        with tempfile.TemporaryDirectory() as t:
            r=Path(t);s=self.source(r);d=a.pack(s,r/'b',C,E);(r/'out').mkdir();(r/'out/user').write_text('keep')
            with self.assertRaises(a.ArtifactError):a.unpack(r/'b',r/'out',d,C,E)
            self.assertEqual((r/'out/user').read_text(),'keep')
    def test_destination_inside_source_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            r=Path(t);s=self.source(r)
            with self.assertRaisesRegex(a.ArtifactError,'destination inside source'):a.pack(s,s/'bundle',C,E)
            self.assertFalse((s/'bundle').exists())

    def test_fifo_source_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            r=Path(t);s=self.source(r);os.mkfifo(s/'.output/fifo')
            with self.assertRaises(a.ArtifactError):a.pack(s,r/'b',C,E)
            self.assertFalse((r/'b').exists())
    def test_extract_failure_keeps_isolated_incomplete_stage(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as t:
            r=Path(t);s=self.source(r);d=a.pack(s,r/'b',C,E)
            with patch('zipfile.ZipFile.open',side_effect=OSError('simulated disk/read failure')):
                with self.assertRaises(a.ArtifactError):a.unpack(r/'b',r/'out',d,C,E)
            self.assertFalse((r/'out').exists())
            self.assertEqual(len(list(r.glob('.out.incomplete-*/INCOMPLETE.txt'))),1)
    def test_cli_failure_is_nonzero_in_current_mode(self):
        with tempfile.TemporaryDirectory() as t:
            r=Path(t);s=self.source(r);a.pack(s,r/'b',C,E)
            cmd=[sys.executable]+(['-O'] if sys.flags.optimize else [])+[str(Path(a.__file__)),'unpack',str(r/'b'),str(r/'out'),C,E,'0'*64]
            result=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertIn('STOP artifact',result.stderr);self.assertFalse((r/'out').exists())
if __name__=='__main__':unittest.main(verbosity=2)
