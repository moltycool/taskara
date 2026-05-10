export const EMPTY_SELECT_VALUE = '__taskara_select_empty__';

export function toSelectValue(value: string | null | undefined) {
   return value || EMPTY_SELECT_VALUE;
}

export function fromSelectValue(value: string) {
   return value === EMPTY_SELECT_VALUE ? '' : value;
}

export function fromSelectValueNullable(value: string) {
   return value === EMPTY_SELECT_VALUE ? null : value;
}
