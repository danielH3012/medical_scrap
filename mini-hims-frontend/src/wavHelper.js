/**
 * Convert any Audio Blob or File (WebM, Opus, Ogg, MP3, M4A, etc.)
 * into a standard 16-bit PCM Mono WAV Blob (16,000 Hz) for speech-to-text.
 */
export async function convertToWav(audioBlobOrFile, targetSampleRate = 16000) {
  if (!audioBlobOrFile || audioBlobOrFile.size === 0) {
    throw new Error('Data audio kosong (0 byte).');
  }

  const arrayBuffer = await audioBlobOrFile.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Browser Anda tidak mendukung Web Audio API.');
  }

  const audioContext = new AudioContextClass();
  let decodedBuffer;
  try {
    decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new Error('Format audio tidak dapat didekode: ' + (err.message || 'File audio tidak valid'));
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  }

  if (!decodedBuffer || decodedBuffer.duration <= 0.1) {
    throw new Error('Durasi audio terlalu singkat (< 0.1 detik). Pastikan Anda berbicara saat merekam.');
  }

  // Resample to target sample rate & convert to mono (1 channel)
  const numFrames = Math.ceil(decodedBuffer.duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, numFrames, targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Encode an AudioBuffer into a RIFF standard 16-bit PCM WAV Blob
 */
function audioBufferToWavBlob(audioBuffer) {
  const numChannels = 1; // mono
  const sampleRate = audioBuffer.sampleRate;
  const bitDepth = 16;
  const samples = audioBuffer.getChannelData(0);
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // 1. RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // 2. "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // 3. "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // 4. PCM Samples (convert float32 -1.0..1.0 to int16)
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
