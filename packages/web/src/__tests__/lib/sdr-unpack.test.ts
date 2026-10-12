import JSZip from 'jszip';
import { extractLabels, unpackSdr, SMARTPGD_MAGIC } from '../../lib/sdr-unpack';

/** Build a SmartDraw text record: tag 0x41 0x00, uint32-LE byte length, UTF-16LE text. */
function labelRecord(s: string): number[] {
  const out = [0x41, 0x00];
  const len = s.length * 2;
  out.push(len & 0xff, (len >>> 8) & 0xff, (len >>> 16) & 0xff, (len >>> 24) & 0xff);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out.push(c & 0xff, (c >>> 8) & 0xff);
  }
  return out;
}

describe('extractLabels', () => {
  it('recovers UTF-16LE label records and ignores binary noise', () => {
    const buf = new Uint8Array([
      0xde, 0xad, 0xbe, 0xef, // noise
      ...labelRecord('JAMIE / ALEX'),
      0x00, 0x00, 0x49, 0x40, // float64 fragment noise
      ...labelRecord('Guest Parking'),
    ]);
    expect(extractLabels(buf)).toEqual(['JAMIE / ALEX', 'Guest Parking']);
  });

  it('skips records with an implausible length', () => {
    const buf = new Uint8Array([
      0x41, 0x00, 0xff, 0xff, 0xff, 0x7f, // absurd length -> not a real record
      ...labelRecord('30 AMP'),
    ]);
    expect(extractLabels(buf)).toEqual(['30 AMP']);
  });

  it('rejects decoded runs that are not printable text', () => {
    // 0x41 0x00 then len=4 then two control-char code units -> rejected
    const buf = new Uint8Array([0x41, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00]);
    expect(extractLabels(buf)).toEqual([]);
  });
});

describe('unpackSdr', () => {
  async function buildSdr(): Promise<Uint8Array> {
    const zip = new JSZip();
    zip.file('manifest.txt', JSON.stringify({
      Version: '2.0',
      Initial: 'page1',
      ResourceMappings: [{ PageID: 'page1', ResourceID: 'res1', Extension: 'png', ResourceType: 1 }],
    }));
    zip.file('page1.sdr', new Uint8Array([
      ...[0x53, 0x4d, 0x41, 0x52, 0x54, 0x44, 0x52, 0x57], // "SMARTDRW"
      ...labelRecord('Helena'),
      ...labelRecord('Adam'),
    ]));
    zip.file('resources/res1.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    const out = new Uint8Array(SMARTPGD_MAGIC.length + zipBytes.length);
    out.set(SMARTPGD_MAGIC, 0);
    out.set(zipBytes, SMARTPGD_MAGIC.length);
    return out;
  }

  it('strips the magic, parses the manifest, and returns rasters + labels', async () => {
    const result = await unpackSdr(await buildSdr());
    expect(result.manifest.Version).toBe('2.0');
    expect(result.rasters).toHaveLength(1);
    expect(result.rasters[0].ext).toBe('png');
    expect(result.rasters[0].mime).toBe('image/png');
    expect(result.rasters[0].bytes.length).toBe(8);
    expect(result.labels).toEqual(['Helena', 'Adam']);
  });

  it('rejects a file without the SMARTPGD magic', async () => {
    await expect(unpackSdr(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/SMARTPGD|not a .*sdr/i);
  });
});
