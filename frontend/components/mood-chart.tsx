"use client"

import { useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface MoodChartProps {
  data: {
    mood: string
    count: number
    emoji: string
  }[]
}

export function MoodChart({ data }: MoodChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const handleMouseEnter = (data: any, index: number) => {
    setActiveIndex(index)
  }

  const handleMouseLeave = () => {
    setActiveIndex(null)
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-2 shadow-md">
          <p className="flex items-center gap-1 text-sm font-medium">
            <span className="text-base">{payload[0].payload.emoji}</span>
            <span>{payload[0].payload.mood}</span>
          </p>
          <p className="text-xs text-muted-foreground">{payload[0].value} entries</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <XAxis
            dataKey="mood"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => data.find((item) => item.mood === value)?.emoji || value}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            className="fill-primary"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
