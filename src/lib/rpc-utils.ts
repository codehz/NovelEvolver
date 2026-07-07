import { molecule, Molecule, onUnmount, use } from "bunshi";
import { RpcCompatible } from "capnweb";

// Input is actually an RpcPromise, but it cause typescript(TS2589): Type instantiation is excessively deep and possibly infinite.
export function convertRpcPromise<T extends RpcCompatible<T>>(
  mol: Molecule<Promise<T>>,
): Molecule<Promise<T>>;
export function convertRpcPromise<T, R>(
  mol: Molecule<Promise<T>>,
  extract: (input: Promise<T>) => Promise<R>,
): Molecule<Promise<R>>;
export function convertRpcPromise<T>(
  mol: Molecule<Promise<T>>,
  extract: (input: Promise<T>) => Promise<T> = (input) => input,
): Molecule<Promise<T>> {
  return molecule(() => Promise.resolve(extract(use(mol))) as Promise<T>);
}

export function wrapDisposable<T extends Disposable>(value: T) {
  onUnmount(() => value[Symbol.dispose]());
  return value;
}
