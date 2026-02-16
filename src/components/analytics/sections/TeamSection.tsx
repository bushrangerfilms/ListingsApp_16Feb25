import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Performance & Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Team performance metrics and predictive analytics coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
