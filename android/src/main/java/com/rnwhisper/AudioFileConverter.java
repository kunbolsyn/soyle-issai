package com.rnwhisper;

import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

final class AudioFileConverter {
  private static final int OUTPUT_SAMPLE_RATE = 16000;
  private static final long CODEC_TIMEOUT_US = 10000;

  private AudioFileConverter() {}

  static double convert(String sourcePath, String outputPath) throws IOException {
    MediaExtractor extractor = new MediaExtractor();
    MediaCodec decoder = null;
    RandomAccessFile output = null;
    long dataSize = 0;
    long inputFrameIndex = 0;
    long outputSampleCount = 0;
    double nextOutputFrame = 0;
    float previousSample = 0;
    int sampleRate = OUTPUT_SAMPLE_RATE;
    int channelCount = 1;
    int pcmEncoding = AudioFormat.ENCODING_PCM_16BIT;

    try {
      extractor.setDataSource(sourcePath);
      int audioTrack = findAudioTrack(extractor);
      if (audioTrack < 0) {
        throw new IOException("The selected file contains no audio track.");
      }

      extractor.selectTrack(audioTrack);
      MediaFormat inputFormat = extractor.getTrackFormat(audioTrack);
      String mime = inputFormat.getString(MediaFormat.KEY_MIME);
      if (mime == null) {
        throw new IOException("The selected audio format is not supported.");
      }

      decoder = MediaCodec.createDecoderByType(mime);
      decoder.configure(inputFormat, null, null, 0);
      decoder.start();

      output = new RandomAccessFile(outputPath, "rw");
      output.setLength(0);
      output.write(new byte[44]);

      MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
      boolean inputEnded = false;
      boolean outputEnded = false;

      while (!outputEnded) {
        if (!inputEnded) {
          int inputIndex = decoder.dequeueInputBuffer(CODEC_TIMEOUT_US);
          if (inputIndex >= 0) {
            ByteBuffer inputBuffer = decoder.getInputBuffer(inputIndex);
            if (inputBuffer == null) {
              throw new IOException("Unable to read the selected audio file.");
            }
            inputBuffer.clear();
            int sampleSize = extractor.readSampleData(inputBuffer, 0);
            if (sampleSize < 0) {
              decoder.queueInputBuffer(
                inputIndex,
                0,
                0,
                0,
                MediaCodec.BUFFER_FLAG_END_OF_STREAM
              );
              inputEnded = true;
            } else {
              decoder.queueInputBuffer(
                inputIndex,
                0,
                sampleSize,
                extractor.getSampleTime(),
                0
              );
              extractor.advance();
            }
          }
        }

        int outputIndex = decoder.dequeueOutputBuffer(bufferInfo, CODEC_TIMEOUT_US);
        if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          MediaFormat outputFormat = decoder.getOutputFormat();
          sampleRate = outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE);
          channelCount = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
          if (outputFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
            pcmEncoding = outputFormat.getInteger(MediaFormat.KEY_PCM_ENCODING);
          }
        } else if (outputIndex >= 0) {
          ByteBuffer pcmBuffer = decoder.getOutputBuffer(outputIndex);
          if (pcmBuffer == null) {
            throw new IOException("The selected audio could not be decoded.");
          }

          if (bufferInfo.size > 0) {
            pcmBuffer.position(bufferInfo.offset);
            pcmBuffer.limit(bufferInfo.offset + bufferInfo.size);
            pcmBuffer.order(ByteOrder.LITTLE_ENDIAN);
            int bytesPerSample = bytesPerSample(pcmEncoding);
            int frameSize = bytesPerSample * channelCount;
            int frameCount = bufferInfo.size / frameSize;
            double sourceFramesPerOutputSample =
              (double) sampleRate / OUTPUT_SAMPLE_RATE;

            for (int frame = 0; frame < frameCount; frame++) {
              float monoSample = readMonoSample(
                pcmBuffer,
                channelCount,
                pcmEncoding
              );
              if (inputFrameIndex == 0) {
                writeResampledSample(output, monoSample);
                outputSampleCount++;
                nextOutputFrame += sourceFramesPerOutputSample;
              } else {
                while (nextOutputFrame <= inputFrameIndex) {
                  double fraction = nextOutputFrame - (inputFrameIndex - 1);
                  float interpolated = (float) (
                    previousSample + (monoSample - previousSample) * fraction
                  );
                  writeResampledSample(output, interpolated);
                  dataSize += 2;
                  outputSampleCount++;
                  nextOutputFrame += sourceFramesPerOutputSample;
                }
              }
              previousSample = monoSample;
              inputFrameIndex++;
            }
          }

          outputEnded =
            (bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
          decoder.releaseOutputBuffer(outputIndex, false);
        }
      }

      if (inputFrameIndex == 0 || outputSampleCount == 0) {
        throw new IOException("The selected file contains no decodable audio.");
      }
      writeWavHeader(output, dataSize);
      return (double) outputSampleCount / OUTPUT_SAMPLE_RATE;
    } catch (IllegalArgumentException | IllegalStateException error) {
      throw new IOException("The selected audio format could not be decoded.", error);
    } finally {
      if (decoder != null) {
        try {
          decoder.stop();
        } catch (IllegalStateException ignored) {
        }
        decoder.release();
      }
      extractor.release();
      if (output != null) {
        output.close();
      }
    }
  }

  private static int findAudioTrack(MediaExtractor extractor) {
    for (int index = 0; index < extractor.getTrackCount(); index++) {
      String mime = extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME);
      if (mime != null && mime.startsWith("audio/")) {
        return index;
      }
    }
    return -1;
  }

  private static int bytesPerSample(int encoding) throws IOException {
    if (encoding == AudioFormat.ENCODING_PCM_FLOAT) return 4;
    if (encoding == AudioFormat.ENCODING_PCM_8BIT) return 1;
    if (encoding == AudioFormat.ENCODING_PCM_16BIT) return 2;
    throw new IOException("The decoded audio uses an unsupported PCM format.");
  }

  private static float readMonoSample(
    ByteBuffer buffer,
    int channels,
    int encoding
  ) {
    float mixedSample = 0;
    for (int channel = 0; channel < channels; channel++) {
      if (encoding == AudioFormat.ENCODING_PCM_FLOAT) {
        mixedSample += buffer.getFloat();
      } else if (encoding == AudioFormat.ENCODING_PCM_8BIT) {
        mixedSample += (buffer.get() & 0xff) / 127.5f - 1f;
      } else {
        mixedSample += buffer.getShort() / 32768f;
      }
    }
    return mixedSample / channels;
  }

  private static void writeResampledSample(RandomAccessFile output, float sample)
    throws IOException {
    float clipped = Math.max(-1f, Math.min(1f, sample));
    int pcm = clipped < 0 ? Math.round(clipped * 32768f) : Math.round(clipped * 32767f);
    output.write(pcm & 0xff);
    output.write((pcm >> 8) & 0xff);
  }

  private static void writeWavHeader(RandomAccessFile output, long dataSize)
    throws IOException {
    if (dataSize > 0xffffffffL - 36) {
      throw new IOException("The selected audio is too large to convert.");
    }
    ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
    header.put(new byte[] {'R', 'I', 'F', 'F'});
    header.putInt((int) (dataSize + 36));
    header.put(new byte[] {'W', 'A', 'V', 'E', 'f', 'm', 't', ' '});
    header.putInt(16);
    header.putShort((short) 1);
    header.putShort((short) 1);
    header.putInt(OUTPUT_SAMPLE_RATE);
    header.putInt(OUTPUT_SAMPLE_RATE * 2);
    header.putShort((short) 2);
    header.putShort((short) 16);
    header.put(new byte[] {'d', 'a', 't', 'a'});
    header.putInt((int) dataSize);
    output.seek(0);
    output.write(header.array());
  }
}