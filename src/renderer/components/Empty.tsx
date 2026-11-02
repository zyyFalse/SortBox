import type { ReactElement } from 'react';

/** 列表没有数据时显示的一句说明。 */
export function Empty(props: { text: string }): ReactElement {
  return <p className="empty">{props.text}</p>;
}
