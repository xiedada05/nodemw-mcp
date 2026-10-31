# 文件

- [测试与验证策略](validation.md) - 本仓库如何证明正确性：完全离线的 vitest 套件（vi.mock 掉 nodemwBot.js、fakeNodemwBot 可变夹具、InMemoryTransport 客户端/服务端对）分别守住工具目录与注解矩阵、写前读守卫加固、输出解析器、safeFetch 边界与命名空间缓存，再加上 lint/build/tsc 与手工 test-server.js 各自证明什么、漏掉什么。
