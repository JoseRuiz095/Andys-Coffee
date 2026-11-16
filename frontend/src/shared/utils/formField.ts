/** Id of a FormField's help/error text: pass it to the control as aria-describedby. */
export function fieldDescriptionId(htmlFor: string) {
  return `${htmlFor}-description`
}
