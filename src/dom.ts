export function getRequiredElement<T extends Element>(
  selector: string,
  elementType: { new (...args: never[]): T },
  parent: ParentNode = document,
): T {
  const element = parent.querySelector(selector);

  if (!(element instanceof elementType)) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}
