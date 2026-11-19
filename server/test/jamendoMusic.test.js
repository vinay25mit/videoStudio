import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJamendoTrackDownload, fetchJamendoTrackPreview, searchJamendoTracks } from '../src/services/jamendoMusic.js';

test('Jamendo search requests weekly popular instrumental tracks and returns only downloadable tracks', async () => {
  let requestedUrl;
  const previewChecks = [];
  const tracks = await searchJamendoTracks({
    clientId: 'test-client-id',
    fetchImpl: async (url, options) => {
      if (options.method === 'HEAD') {
        previewChecks.push(String(url));
        return { ok: String(url).endsWith('preview.mp3') };
      }
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          headers: { status: 'success' },
          results: [
            {
              id: 101,
              name: 'Current Beat',
              artist_name: 'Studio Artist',
              audio: 'https://audio.example/preview.mp3',
              audiodownload: 'https://audio.example/download.mp3',
              audiodownload_allowed: true,
              license_ccurl: 'https://creativecommons.org/licenses/by/4.0/',
              shareurl: 'https://www.jamendo.com/track/101',
              duration: 95,
              stats: { popularity_total: '80' },
            },
            {
              id: 102,
              name: 'Stream Only',
              audio: 'https://audio.example/preview-only.mp3',
              audiodownload: '',
              audiodownload_allowed: false,
            },
          ],
        }),
      };
    },
  });

  assert.equal(requestedUrl.searchParams.get('client_id'), 'test-client-id');
  assert.equal(requestedUrl.searchParams.get('order'), 'popularity_week');
  assert.equal(requestedUrl.searchParams.get('vocalinstrumental'), 'instrumental');
  assert.deepEqual(previewChecks, ['https://audio.example/preview.mp3']);
  assert.equal(tracks.length, 1);
  assert.deepEqual(tracks[0], {
    id: '101',
    name: 'Current Beat',
    artist: 'Studio Artist',
    album: '',
    duration: 95,
    previewUrl: 'https://audio.example/preview.mp3',
    downloadUrl: 'https://audio.example/download.mp3',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    pageUrl: 'https://www.jamendo.com/track/101',
    imageUrl: '',
    popularity: 80,
  });
});

test('Jamendo search rejects missing credentials and unsupported genres', async () => {
  await assert.rejects(
    searchJamendoTracks({ clientId: '' }),
    /JAMENDO_CLIENT_ID/,
  );
  await assert.rejects(
    searchJamendoTracks({ clientId: 'test-client-id', genre: 'unknown' }),
    /supported music category/,
  );
});

test('Jamendo search reports provider errors', async () => {
  await assert.rejects(
    searchJamendoTracks({
      clientId: 'test-client-id',
      fetchImpl: async () => ({ ok: false, status: 429 }),
    }),
    /HTTP 429/,
  );
});

test('Hindi song search includes vocal Hindi tracks instead of filtering to instrumentals', async () => {
  let requestedUrl;
  const tracks = await searchJamendoTracks({
    clientId: 'test-client-id',
    genre: 'hindi',
    fetchImpl: async (url, options) => {
      if (options.method === 'HEAD') return { ok: true };
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          headers: { status: 'success' },
          results: [{
            id: 501,
            name: 'Baarish',
            artist_name: 'Arun Chillara',
            audio: 'https://audio.example/hindi.mp3',
            audiodownload: 'https://audio.example/hindi-download.mp3',
            audiodownload_allowed: true,
          }],
        }),
      };
    },
  });

  assert.equal(requestedUrl.searchParams.get('tags'), 'hindi');
  assert.equal(requestedUrl.searchParams.has('vocalinstrumental'), false);
  assert.equal(requestedUrl.searchParams.has('featured'), false);
  assert.equal(tracks[0].name, 'Baarish');
});

test('Hindi instrumental search retains the instrumental filter', async () => {
  let requestedUrl;
  await searchJamendoTracks({
    clientId: 'test-client-id',
    genre: 'hindi-instrumental',
    fetchImpl: async (url, options) => {
      if (options.method === 'HEAD') return { ok: true };
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          headers: { status: 'success' },
          results: [{
            id: 502,
            name: 'Hindi Instrumental',
            artist_name: 'Studio Artist',
            audio: 'https://audio.example/hindi-instrumental.mp3',
            audiodownload: 'https://audio.example/hindi-instrumental-download.mp3',
            audiodownload_allowed: true,
          }],
        }),
      };
    },
  });

  assert.equal(requestedUrl.searchParams.get('tags'), 'hindi');
  assert.equal(requestedUrl.searchParams.get('vocalinstrumental'), 'instrumental');
});

test('Jamendo search gives actionable guidance when the client ID is unauthorized', async () => {
  await assert.rejects(
    searchJamendoTracks({
      clientId: 'test-client-id',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          headers: {
            status: 'failed',
            error_message: 'Jamendo Api Invalid Client Id Error: Your credential is not authorized.',
          },
          results: [],
        }),
      }),
    }),
    /Jamendo rejected the client ID.*active Client ID from your Jamendo developer app/,
  );
});

test('Jamendo preview resolves audio on the server and forwards byte range requests', async () => {
  const requests = [];
  const preview = await fetchJamendoTrackPreview({
    clientId: 'test-client-id',
    trackId: '101',
    range: 'bytes=0-99',
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), range: options.headers?.Range });
      if (String(url).includes('api.jamendo.com')) {
        return new Response(JSON.stringify({
          headers: { status: 'success' },
          results: [{
            id: 101,
            name: 'Current Beat',
            artist_name: 'Studio Artist',
            audio: 'https://audio.example/preview.mp3',
            audiodownload: 'https://audio.example/download.mp3',
            audiodownload_allowed: true,
          }],
        }), { headers: { 'content-type': 'application/json' } });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: { 'content-type': 'audio/mpeg' },
      });
    },
  });

  assert.equal(requests.length, 3);
  assert.match(requests[0].url, /id=101/);
  assert.equal(requests[1].url, 'https://audio.example/preview.mp3');
  assert.equal(requests[1].range, undefined);
  assert.equal(requests[2].url, 'https://audio.example/preview.mp3');
  assert.equal(requests[2].range, 'bytes=0-99');
  assert.equal(preview.status, 206);
  assert.equal(preview.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual([...new Uint8Array(await preview.arrayBuffer())], [1, 2, 3]);
});

test('Jamendo preview uses the listed track URL and rejects URLs for other hosts or track IDs', async () => {
  let requestedUrl;
  const preview = await fetchJamendoTrackPreview({
    clientId: 'test-client-id',
    trackId: '501',
    previewUrl: 'https://prod-1.storage.jamendo.com/?trackid=501&format=mp32&from=signed',
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return new Response(new Uint8Array([4, 5, 6]), {
        headers: { 'content-type': 'audio/mpeg' },
      });
    },
  });

  assert.equal(requestedUrl, 'https://prod-1.storage.jamendo.com/?trackid=501&format=mp32&from=signed');
  assert.deepEqual([...new Uint8Array(await preview.arrayBuffer())], [4, 5, 6]);
  await assert.rejects(
    fetchJamendoTrackPreview({
      clientId: 'test-client-id',
      trackId: '501',
      previewUrl: 'https://example.com/?trackid=501',
    }),
    /preview URL does not match the selected track/,
  );
  await assert.rejects(
    fetchJamendoTrackPreview({
      clientId: 'test-client-id',
      trackId: '501',
      previewUrl: 'https://prod-1.storage.jamendo.com/?trackid=502',
    }),
    /preview URL does not match the selected track/,
  );
});

test('Jamendo title searches include non-featured matching tracks', async () => {
  let requestedUrl;
  await searchJamendoTracks({
    clientId: 'test-client-id',
    genre: 'cinematic',
    search: 'Dark Eye',
    fetchImpl: async (url, options) => {
      if (options.method === 'HEAD') return { ok: true };
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({
        headers: { status: 'success' },
        results: [{
          id: 700,
          name: 'Dark Eye',
          artist_name: 'Marc Teichert',
          audio: 'https://audio.example/dark-eye.mp3',
          audiodownload: 'https://www.jamendo.com/download/700.mp3',
          audiodownload_allowed: true,
        }],
      }), { headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(requestedUrl.searchParams.get('namesearch'), 'Dark Eye');
  assert.equal(requestedUrl.searchParams.has('featured'), false);
});

test('Jamendo full-track download only fetches permitted Jamendo-hosted URLs', async () => {
  const requests = [];
  const response = await fetchJamendoTrackDownload({
    clientId: 'test-client-id',
    trackId: '701',
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), method: options.method || 'GET' });
      if (String(url).includes('api.jamendo.com')) {
        return new Response(JSON.stringify({
          headers: { status: 'success' },
          results: [{
            id: 701,
            name: 'Dark Eye',
            artist_name: 'Marc Teichert',
            audio: 'https://audio.example/dark-eye-preview.mp3',
            audiodownload: 'https://www.jamendo.com/download/701.mp3',
            audiodownload_allowed: true,
          }],
        }), { headers: { 'content-type': 'application/json' } });
      }
      if (options.method === 'HEAD') return { ok: true };
      return new Response('full audio track', { status: 200 });
    },
  });

  assert.equal(requests.at(-1).url, 'https://www.jamendo.com/download/701.mp3');
  assert.equal(await response.text(), 'full audio track');
  await assert.rejects(
    fetchJamendoTrackDownload({
      clientId: 'test-client-id',
      trackId: '702',
      fetchImpl: async (url, options) => {
        if (options.method === 'HEAD') return { ok: true };
        return new Response(JSON.stringify({
          headers: { status: 'success' },
          results: [{
            id: 702,
            name: 'Untrusted URL',
            artist_name: 'Artist',
            audio: 'https://audio.example/preview.mp3',
            audiodownload: 'https://evil.example/track.mp3',
            audiodownload_allowed: true,
          }],
        }), { headers: { 'content-type': 'application/json' } });
      },
    }),
    /download URL is invalid/,
  );
});
