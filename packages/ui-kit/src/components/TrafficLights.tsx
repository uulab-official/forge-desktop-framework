export interface TrafficLightsProps {
  spacing?: number;
}

export function TrafficLights({ spacing = 70 }: TrafficLightsProps) {
  return <div className="shrink-0" style={{ width: spacing }} />;
}
