import { Button } from "antd";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import "./operations-header.css";

export interface OperationsHeaderProps {
  title: string;
  description: string;
  /** 返回事件回调（传入时在标题左侧渲染统一返回按钮） */
  onBack?: () => void;
  /** 返回目标路径（传入时在标题左侧渲染统一返回按钮） */
  backTo?: string;
  /** 返回按钮无障碍标签，默认“返回上一页” */
  backAriaLabel?: string;
  /** 自定义 leading 元素（若提供了 onBack/backTo，则优先渲染返回按钮） */
  leading?: ReactNode;
  /** 右侧操作插槽 */
  actions?: ReactNode;
}

export function OperationsHeader({
  title,
  description,
  onBack,
  backTo,
  backAriaLabel = "返回上一页",
  leading,
  actions,
}: OperationsHeaderProps): ReactNode {
  const navigate = useNavigate();

  const renderLeading = () => {
    if (backTo || onBack) {
      return (
        <Button
          type="text"
          className="operations-header__back"
          aria-label={backAriaLabel}
          title={backAriaLabel}
          icon={<ArrowLeft size={16} />}
          onClick={() => {
            if (backTo) void navigate(backTo);
            else onBack?.();
          }}
        />
      );
    }
    return leading ? <div className="operations-header__leading">{leading}</div> : null;
  };

  const leadingNode = renderLeading();

  return (
    <div className="operations-header-frame">
      <header className="operations-header">
        <div className="operations-header__main">
          {leadingNode ? (
            <div className="operations-header__leading-wrap">{leadingNode}</div>
          ) : null}
          <div className="operations-header__identity">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </div>
        {actions ? <div className="operations-header__actions">{actions}</div> : null}
      </header>
    </div>
  );
}
