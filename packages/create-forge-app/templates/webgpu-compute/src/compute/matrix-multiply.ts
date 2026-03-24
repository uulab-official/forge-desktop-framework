const SHADER_CODE = /* wgsl */ `
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> result: array<f32>;

struct Uniforms {
  M: u32,
  N: u32,
  K: u32,
  pad: u32,
}
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  let col = id.y;
  if (row >= uniforms.M || col >= uniforms.N) {
    return;
  }
  var sum: f32 = 0.0;
  for (var i: u32 = 0; i < uniforms.K; i = i + 1) {
    sum = sum + a[row * uniforms.K + i] * b[i * uniforms.N + col];
  }
  result[row * uniforms.N + col] = sum;
}
`;

function generateRandomMatrix(size: number): Float32Array {
  const data = new Float32Array(size * size);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random();
  }
  return data;
}

export async function gpuMatrixMultiply(
  device: GPUDevice,
  size: number,
): Promise<{ timeMs: number; resultSample: number[] }> {
  const matA = generateRandomMatrix(size);
  const matB = generateRandomMatrix(size);
  const resultSize = size * size * Float32Array.BYTES_PER_ELEMENT;

  // Create GPU buffers
  const bufferA = device.createBuffer({
    size: matA.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(bufferA, 0, matA);

  const bufferB = device.createBuffer({
    size: matB.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(bufferB, 0, matB);

  const bufferResult = device.createBuffer({
    size: resultSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const uniformData = new Uint32Array([size, size, size, 0]);
  const bufferUniform = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(bufferUniform, 0, uniformData);

  const readbackBuffer = device.createBuffer({
    size: resultSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // Create compute pipeline
  const shaderModule = device.createShaderModule({ code: SHADER_CODE });
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModule, entryPoint: 'main' },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: bufferA } },
      { binding: 1, resource: { buffer: bufferB } },
      { binding: 2, resource: { buffer: bufferResult } },
      { binding: 3, resource: { buffer: bufferUniform } },
    ],
  });

  // Dispatch compute
  const workgroupCount = Math.ceil(size / 8);
  const startTime = performance.now();

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(workgroupCount, workgroupCount);
  pass.end();

  encoder.copyBufferToBuffer(bufferResult, 0, readbackBuffer, 0, resultSize);
  device.queue.submit([encoder.finish()]);

  // Read back results
  await readbackBuffer.mapAsync(GPUMapMode.READ);
  const endTime = performance.now();

  const resultData = new Float32Array(readbackBuffer.getMappedRange().slice(0));
  readbackBuffer.unmap();

  // Cleanup
  bufferA.destroy();
  bufferB.destroy();
  bufferResult.destroy();
  bufferUniform.destroy();
  readbackBuffer.destroy();

  const sampleCount = Math.min(10, size * size);
  const resultSample = Array.from(resultData.slice(0, sampleCount));

  return {
    timeMs: Math.round((endTime - startTime) * 100) / 100,
    resultSample,
  };
}

export function cpuMatrixMultiply(
  size: number,
): { timeMs: number; resultSample: number[] } {
  const a = generateRandomMatrix(size);
  const b = generateRandomMatrix(size);
  const result = new Float32Array(size * size);

  const startTime = performance.now();
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      let sum = 0;
      for (let k = 0; k < size; k++) {
        sum += a[i * size + k] * b[k * size + j];
      }
      result[i * size + j] = sum;
    }
  }
  const endTime = performance.now();

  const sampleCount = Math.min(10, size * size);
  const resultSample = Array.from(result.slice(0, sampleCount));

  return {
    timeMs: Math.round((endTime - startTime) * 100) / 100,
    resultSample,
  };
}
