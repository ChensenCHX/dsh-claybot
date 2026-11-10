import fs from 'node:fs'

const GGUF_MAGIC = 'GGUF'
const GGUF_TYPE = {
  UINT8: 0,
  INT8: 1,
  UINT16: 2,
  INT16: 3,
  UINT32: 4,
  INT32: 5,
  FLOAT32: 6,
  BOOL: 7,
  STRING: 8,
  ARRAY: 9,
  UINT64: 10,
  INT64: 11,
  FLOAT64: 12,
}

function scalarSize(type) {
  switch (type) {
    case GGUF_TYPE.UINT8:
    case GGUF_TYPE.INT8:
    case GGUF_TYPE.BOOL:
      return 1
    case GGUF_TYPE.UINT16:
    case GGUF_TYPE.INT16:
      return 2
    case GGUF_TYPE.UINT32:
    case GGUF_TYPE.INT32:
    case GGUF_TYPE.FLOAT32:
      return 4
    case GGUF_TYPE.UINT64:
    case GGUF_TYPE.INT64:
    case GGUF_TYPE.FLOAT64:
      return 8
    default:
      return null
  }
}

class Reader {
  constructor(fd, size) {
    this.fd = fd
    this.size = size
    this.position = 0
    this.buffer = Buffer.alloc(64 * 1024)
    this.bufferStart = 0
    this.bufferLength = 0
  }

  fill() {
    if (this.position >= this.size) throw new Error('unexpected end of GGUF metadata')
    const start = this.bufferStart + this.bufferLength
    const length = Math.min(this.buffer.length, this.size - start)
    const read = fs.readSync(this.fd, this.buffer, 0, length, start)
    if (read <= 0) throw new Error('unexpected end of GGUF metadata')
    this.bufferStart = start
    this.bufferLength = read
  }

  read(length) {
    if (length > 16 * 1024 * 1024) throw new Error('GGUF metadata string is too large')
    const result = Buffer.alloc(length)
    let offset = 0
    while (offset < length) {
      if (this.position < this.bufferStart || this.position >= this.bufferStart + this.bufferLength) {
        this.bufferStart = this.position
        this.bufferLength = 0
        this.fill()
      }
      const start = this.position - this.bufferStart
      const available = this.bufferLength - start
      const take = Math.min(available, length - offset)
      this.buffer.copy(result, offset, start, start + take)
      offset += take
      this.position += take
    }
    return result
  }

  skip(length) {
    if (length < 0) throw new Error('negative GGUF skip')
    this.position += length
    if (this.position > this.size) throw new Error('unexpected end of GGUF metadata')
  }

  u32() {
    return this.read(4).readUInt32LE(0)
  }

  u64() {
    const value = this.read(8).readBigUInt64LE(0)
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('GGUF integer is too large')
    return Number(value)
  }

  string() {
    const length = this.u64()
    return this.read(length).toString('utf8')
  }

  value(type) {
    const size = scalarSize(type)
    if (size !== null) {
      const bytes = this.read(size)
      switch (type) {
        case GGUF_TYPE.UINT8: return bytes.readUInt8(0)
        case GGUF_TYPE.INT8: return bytes.readInt8(0)
        case GGUF_TYPE.UINT16: return bytes.readUInt16LE(0)
        case GGUF_TYPE.INT16: return bytes.readInt16LE(0)
        case GGUF_TYPE.UINT32: return bytes.readUInt32LE(0)
        case GGUF_TYPE.INT32: return bytes.readInt32LE(0)
        case GGUF_TYPE.FLOAT32: return bytes.readFloatLE(0)
        case GGUF_TYPE.BOOL: return bytes.readUInt8(0) !== 0
        case GGUF_TYPE.UINT64: return Number(bytes.readBigUInt64LE(0))
        case GGUF_TYPE.INT64: return Number(bytes.readBigInt64LE(0))
        case GGUF_TYPE.FLOAT64: return bytes.readDoubleLE(0)
        default: return null
      }
    }
    if (type === GGUF_TYPE.STRING) return this.string()
    if (type === GGUF_TYPE.ARRAY) {
      const itemType = this.u32()
      const count = this.u64()
      for (let index = 0; index < count; index += 1) this.skipValue(itemType)
      return null
    }
    throw new Error('unsupported GGUF value type: ' + String(type))
  }

  skipValue(type) {
    const size = scalarSize(type)
    if (size !== null) {
      this.skip(size)
      return
    }
    if (type === GGUF_TYPE.STRING) {
      const length = this.u64()
      this.skip(length)
      return
    }
    if (type === GGUF_TYPE.ARRAY) {
      const itemType = this.u32()
      const count = this.u64()
      for (let index = 0; index < count; index += 1) this.skipValue(itemType)
      return
    }
    throw new Error('unsupported GGUF value type: ' + String(type))
  }
}

function poolingFromMetadata(architecture, value) {
  if (value === 1) return 'mean'
  if (value === 2) return 'cls'
  if (value === 3) return 'last'
  const arch = String(architecture || '').toLowerCase()
  if (arch.includes('qwen')) return 'last'
  if (arch.includes('nomic')) return 'mean'
  if (arch.includes('bert')) return 'cls'
  return null
}

export function readGgufMetadata(filePath) {
  const fd = fs.openSync(filePath, 'r')
  try {
    const stat = fs.fstatSync(fd)
    const reader = new Reader(fd, stat.size)
    const magic = reader.read(4).toString('utf8')
    if (magic !== GGUF_MAGIC) throw new Error('not a GGUF file')
    const version = reader.u32()
    if (version < 2 || version > 3) throw new Error('unsupported GGUF version: ' + String(version))
    const tensorCount = reader.u64()
    const metadataCount = reader.u64()

    let architecture = null
    let name = null
    let dimensions = null
    let contextLength = null
    let poolingValue = null

    for (let index = 0; index < metadataCount; index += 1) {
      const key = reader.string()
      const type = reader.u32()
      let keep = false
      if (key === 'general.architecture') keep = true
      else if (key === 'general.name') keep = true
      else if (key.endsWith('.embedding_length')) keep = true
      else if (key.endsWith('.context_length')) keep = true
      else if (key.endsWith('.pooling_type')) keep = true

      if (!keep) {
        reader.skipValue(type)
        continue
      }
      if (type === GGUF_TYPE.ARRAY) {
        reader.skipValue(type)
        continue
      }
      const value = reader.value(type)
      if (key === 'general.architecture') architecture = String(value)
      else if (key === 'general.name') name = String(value)
      else if (key.endsWith('.embedding_length') && dimensions === null) dimensions = Number(value)
      else if (key.endsWith('.context_length') && contextLength === null) contextLength = Number(value)
      else if (key.endsWith('.pooling_type') && poolingValue === null) poolingValue = Number(value)
    }

    const maxContext = Number.isFinite(contextLength) && contextLength > 0 ? contextLength : null
    const suggestedContext = maxContext === null ? 2048 : Math.min(maxContext, 2048)
    const pooling = poolingFromMetadata(architecture, poolingValue)
    return {
      version,
      tensorCount,
      metadataCount,
      architecture,
      name,
      dimensions: Number.isFinite(dimensions) && dimensions > 0 ? dimensions : null,
      contextSize: suggestedContext,
      maxContext,
      pooling,
    }
  } finally {
    fs.closeSync(fd)
  }
}
