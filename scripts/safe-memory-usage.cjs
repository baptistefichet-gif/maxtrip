// Some managed Node runtimes expose process.memoryUsage() but fail when
// libuv tries to read RSS. Next.js calls it during production builds.
// Keep the native implementation whenever it works and provide a conservative
// V8-based fallback only for that broken runtime.
const v8 = require("node:v8");
const nativeMemoryUsage = process.memoryUsage.bind(process);

process.memoryUsage = function safeMemoryUsage() {
  try {
    return nativeMemoryUsage();
  } catch (error) {
    if (error?.code !== "ENOENT" || error?.syscall !== "uv_resident_set_memory") {
      throw error;
    }

    const heap = v8.getHeapStatistics();
    return {
      rss: heap.total_heap_size,
      heapTotal: heap.total_heap_size,
      heapUsed: heap.used_heap_size,
      external: 0,
      arrayBuffers: 0
    };
  }
};
