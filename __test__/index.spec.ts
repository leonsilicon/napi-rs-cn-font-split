import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import test from 'ava'

import { fontSplit } from '../index'

const fontPath = fileURLToPath(new URL('./fixtures/test-font.ttf', import.meta.url))

// Encode a minimal `InputTemplate` protobuf by hand: field 1 (`bytes input`), wire type 2
// (length-delimited). Every other field is optional, so this is a complete valid request and
// avoids pulling the full generated proto into the test.
function encodeInputTemplate(font: Buffer): Buffer {
  const encodeVarint = (n: number): Buffer => {
    const out: number[] = []
    while (n > 0x7f) {
      out.push((n & 0x7f) | 0x80)
      n >>>= 7
    }
    out.push(n)
    return Buffer.from(out)
  }
  const tag = Buffer.from([(1 << 3) | 2])
  return Buffer.concat([tag, encodeVarint(font.length), font])
}

// Decode just enough of an `EventMessage` { event: 1 (varint), message: 2 (string), data: 3
// (bytes) } to assert on the stream contents.
function decodeEvent(buf: Buffer): { event: number; message: string; dataLen: number } {
  let i = 0
  const ev = { event: 0, message: '', dataLen: 0 }
  const varint = (): number => {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = buf[i++]
      result |= (byte & 0x7f) << shift
      shift += 7
    } while (byte & 0x80)
    return result >>> 0
  }
  while (i < buf.length) {
    const tag = varint()
    const field = tag >> 3
    const wireType = tag & 7
    if (field === 1 && wireType === 0) {
      ev.event = varint()
    } else if (field === 2 && wireType === 2) {
      const len = varint()
      ev.message = buf.slice(i, i + len).toString('utf8')
      i += len
    } else if (field === 3 && wireType === 2) {
      const len = varint()
      ev.dataLen = len
      i += len
    } else if (wireType === 2) {
      i += varint()
    } else if (wireType === 0) {
      varint()
    } else {
      break
    }
  }
  return ev
}

const EVENT_OUTPUT_DATA = 1
const EVENT_END = 2

test('fontSplit returns EventMessage buffers', (t) => {
  const font = readFileSync(fontPath)
  const events = fontSplit(encodeInputTemplate(font))

  t.true(Array.isArray(events))
  t.true(events.length > 0, 'expected at least one event')
  t.true(
    events.every((b) => Buffer.isBuffer(b)),
    'every event should be a Buffer',
  )
})

test('fontSplit emits OUTPUT_DATA chunks terminated by END', (t) => {
  const font = readFileSync(fontPath)
  const decoded = fontSplit(encodeInputTemplate(font)).map(decodeEvent)

  const outputData = decoded.filter((e) => e.event === EVENT_OUTPUT_DATA)
  t.true(outputData.length > 0, 'expected at least one OUTPUT_DATA event')
  t.true(
    outputData.some((e) => e.message.endsWith('.woff2') && e.dataLen > 0),
    'expected at least one non-empty .woff2 chunk',
  )

  const last = decoded.at(-1)
  t.is(last?.event, EVENT_END, 'stream should end with an END event')
})
