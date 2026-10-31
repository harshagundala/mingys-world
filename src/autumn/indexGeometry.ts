import * as T from "three";

/** Share only identical vertices. Unlike tolerance-based welding, no surface moves. */
export function indexGeometry(source: T.BufferGeometry): T.BufferGeometry {
  const result = source.clone();
  if (source.index) return result;
  const count = source.getAttribute("position").count;
  const entries = Object.entries(source.attributes);
  // These are static, ordinary vertex buffers. Preserve unusual attributes unchanged.
  if (
    Object.keys(source.morphAttributes).length ||
    entries.some(([, attribute]) => !(attribute instanceof T.BufferAttribute))
  ) {
    result.setIndex(Array.from({ length: count }, (_, index) => index));
    return result;
  }
  const attributes = entries as [string, T.BufferAttribute][];
  const vertices = new Map<string, number>();
  const originals: number[] = [];
  const indices: number[] = [];
  for (let vertex = 0; vertex < count; vertex++) {
    let key = "";
    for (const [, attribute] of attributes) {
      const offset = vertex * attribute.itemSize;
      for (let component = 0; component < attribute.itemSize; component++) {
        const value = attribute.array[offset + component];
        key += `${Object.is(value, -0) ? "-0" : value},`;
      }
      key += ";";
    }
    let index = vertices.get(key);
    if (index === undefined) {
      index = originals.length;
      vertices.set(key, index);
      originals.push(vertex);
    }
    indices.push(index);
  }
  for (const [name, attribute] of attributes) {
    const array = attribute.array.slice(
      0,
      originals.length * attribute.itemSize,
    );
    originals.forEach((original, index) => {
      const offset = original * attribute.itemSize;
      for (let component = 0; component < attribute.itemSize; component++)
        array[index * attribute.itemSize + component] =
          attribute.array[offset + component];
    });
    const Attribute = attribute.constructor as typeof T.BufferAttribute;
    const compact = new Attribute(
      array,
      attribute.itemSize,
      attribute.normalized,
    );
    compact.name = attribute.name;
    compact.setUsage(attribute.usage);
    compact.gpuType = attribute.gpuType;
    result.setAttribute(name, compact);
  }
  result.setIndex(indices);
  return result;
}
