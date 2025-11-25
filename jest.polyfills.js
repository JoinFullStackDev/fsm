// Polyfills that must be set up before any mocks or imports
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'stream/web'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
if (typeof ReadableStream !== 'undefined') {
  global.ReadableStream = ReadableStream
}

