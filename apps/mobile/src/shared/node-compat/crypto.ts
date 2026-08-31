import { asBytes } from "../../native/sha1";
import { sha1Native } from "../../native/sha1-native";

type HashInput = string | Uint8Array | ArrayBuffer;
type Hash = {
  update(data: HashInput, encoding?: string): Hash;
  digest(encoding?: string): string | Uint8Array;
};

function unsupported(operation: string): never {
  throw new Error(`移动端 crypto stub 不支持 ${operation}`);
}

export function createHash(algorithm: string): Hash {
  if (algorithm.toLowerCase() !== "sha1") return unsupported(`createHash(${algorithm})`);
  const chunks: Uint8Array[] = [];
  let digested = false;
  return {
    update(data, encoding = "utf8") {
      if (digested) return unsupported("在 digest 后继续 update");
      if (encoding !== "utf8" && encoding !== "utf-8") {
        return unsupported(`编码 ${encoding}`);
      }
      chunks.push(asBytes(data));
      return this;
    },
    digest(encoding = "buffer") {
      if (digested) return unsupported("重复 digest");
      digested = true;
      const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
      const bytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const hex = sha1Native(bytes);
      if (encoding === "hex") return hex;
      return unsupported(`digest(${encoding})`);
    },
  };
}

const cryptoStub = { createHash };
export default cryptoStub;
