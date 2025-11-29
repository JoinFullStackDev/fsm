'use client';

import MetricWidget from './widgets/MetricWidget';
import ChartWidget from './widgets/ChartWidget';
import TableWidget from './widgets/TableWidget';
import AIInsightWidget from './widgets/AIInsightWidget';
import RichTextWidget from './widgets/RichTextWidget';

interface WidgetRendererProps {
  widget: {
    id: string;
    widget_type: string;
    dataset: any;
    settings?: any;
  };
  dashboardId: string;
}

export default function WidgetRenderer({ widget, dashboardId }: WidgetRendererProps) {
  const commonProps = {
    widgetId: widget.id,
    dashboardId,
    dataset: widget.dataset || {},
    settings: widget.settings || {},
  };

  switch (widget.widget_type) {
    case 'metric':
      return <MetricWidget {...commonProps} />;
    case 'chart':
      return <ChartWidget {...commonProps} />;
    case 'table':
      return <TableWidget {...commonProps} />;
    case 'ai_insight':
      return <AIInsightWidget {...commonProps} />;
    case 'rich_text':
      return <RichTextWidget {...commonProps} />;
    default:
      return (
        <div>
          Unknown widget type: {widget.widget_type}
        </div>
      );
  }
}

