import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
const Card = () => (
  <HoverCard>
    <HoverCardTrigger>Hover</HoverCardTrigger>
    <HoverCardContent>
      The React Framework – created and maintained by @vercel.
    </HoverCardContent>
  </HoverCard>
);

export function App() {
  return (
    <div>
      hello world!
      <Card />
    </div>
  );
}
