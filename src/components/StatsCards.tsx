
import { Card, CardContent } from "@/components/ui/card";
import { Package, TrendingUp, Euro, Star } from "lucide-react";

interface Stat {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  color: string;
}

interface StatsCardsProps {
  stats: Stat[];
}

const StatsCards = ({ stats }: StatsCardsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {stats.map((stat, index) => (
      <Card key={index}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-green-600">{stat.change}</p>
            </div>
            <stat.icon className={`h-8 w-8 ${stat.color}`} />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default StatsCards;

