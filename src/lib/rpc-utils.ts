import { molecule, Molecule, use } from "bunshi";
import { RpcPromise } from "capnweb";

export function convertRpcPromise<T>(mol: Molecule<RpcPromise<T>>): Molecule<Promise<T>>;
export function convertRpcPromise<T, R>(
  mol: Molecule<RpcPromise<T>>,
  extract: (input: RpcPromise<T>) => RpcPromise<R>,
): Molecule<Promise<R>>;
export function convertRpcPromise<T>(
  mol: Molecule<RpcPromise<T>>,
  extract: (input: RpcPromise<T>) => RpcPromise<T> = (input) => input,
): Molecule<Promise<T>> {
  return molecule(() => Promise.resolve(extract(use(mol))) as Promise<T>);
}
