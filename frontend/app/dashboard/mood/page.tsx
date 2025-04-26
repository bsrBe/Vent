"use client"

import { useState, useEffect, useCallback } from "react"
import { format, subDays, subMonths, parseISO } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MoodChart } from "@/components/mood-chart"
import { fetchAuthenticated } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

// Define types
interface MoodType {
  _id: string
  name: string
  emoji: string
  colorCode?: string
}

interface MoodStat {
  moodType: {
    id: string; // Note: Backend aggregation might use 'id' instead of '_id'
    name: string;
    emoji: string;
    colorCode?: string;
  };
  count: number;
  averageIntensity?: number;
}

interface CalendarMoodEntry {
  id: string;
  intensity?: number;
  notes?: string;
  moodType: MoodType; // Populated mood type
}

interface CalendarData {
  [dateKey: string]: CalendarMoodEntry[]; // dateKey is 'yyyy-MM-dd'
}

interface MoodInsights {
   period: string;
   totalMoodsRecorded: number;
   // Add other insight fields as defined by backend
}

// Helper to get color class (can be shared or moved to utils)
const getMoodColorClass = (colorCode?: string): string => {
  switch (colorCode?.toLowerCase()) {
    case "#4ade80": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"; // Happy
    case "#60a5fa": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"; // Calm
    case "#818cf8": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"; // Sad
    case "#f87171": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"; // Angry
    case "#facc15": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"; // Anxious
    case "#9ca3af": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"; // Neutral
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

export default function MoodPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(new Date())
  const [statsPeriod, setStatsPeriod] = useState("month") // 'week', 'month', '3months', 'custom'
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({
     from: undefined,
     to: undefined
  });

  // State for fetched data
  const [moodStats, setMoodStats] = useState<MoodStat[]>([]);
  const [mostFrequentMood, setMostFrequentMood] = useState<MoodStat['moodType'] | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData>({});
  const [moodInsights, setMoodInsights] = useState<MoodInsights | null>(null);
  const [moodTypes, setMoodTypes] = useState<MoodType[]>([]); // Also used for Today's Mood card

  // Loading states
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  const [isLoadingMoodTypes, setIsLoadingMoodTypes] = useState(true);
  const [isLoggingMood, setIsLoggingMood] = useState<string | null>(null); // Store ID of mood being logged

  // Fetch mood types (needed for calendar display and Today's Mood card)
   useEffect(() => {
    const fetchMoodTypes = async () => {
      setIsLoadingMoodTypes(true);
      try {
        const response = await fetchAuthenticated<{ moodTypes: MoodType[] }>("/api/v1/moods/types");
        if (response.status === "success" && response.data?.moodTypes) {
          setMoodTypes(response.data.moodTypes);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Could not fetch mood types." });
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch mood types." });
        if (error.message.includes("Session expired")) {
          router.push("/login");
        }
      } finally {
        setIsLoadingMoodTypes(false);
      }
    };
    fetchMoodTypes();
  }, [toast, router]);


  // Fetch Stats Data based on period/range
  useEffect(() => {
     const fetchStats = async () => {
       setIsLoadingStats(true);
       const params = new URLSearchParams();
       params.set('period', statsPeriod);

       if (statsPeriod === 'custom' && customDateRange.from) {
         params.set('fromDate', format(customDateRange.from, 'yyyy-MM-dd'));
       }
       if (statsPeriod === 'custom' && customDateRange.to) {
         params.set('toDate', format(customDateRange.to, 'yyyy-MM-dd'));
       }

       try {
         const response = await fetchAuthenticated<{
            mostFrequentMood: MoodStat['moodType'] | null;
            moodCounts: MoodStat[];
            dateRange: { from: string; to: string };
         }>(`/api/v1/moods/stats?${params.toString()}`);

         if (response.status === 'success' && response.data) {
           setMoodStats(response.data.moodCounts || []);
           setMostFrequentMood(response.data.mostFrequentMood || null);
           // Update custom date range display if backend adjusted it for 'custom' period
           if (statsPeriod === 'custom' && response.data.dateRange) {
              setCustomDateRange({ from: parseISO(response.data.dateRange.from), to: parseISO(response.data.dateRange.to) });
           }
         } else {
           toast({ variant: "destructive", title: "Error", description: response.message || "Could not fetch mood stats." });
           setMoodStats([]);
           setMostFrequentMood(null);
         }
       } catch (error: any) {
         toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch mood stats." });
         setMoodStats([]);
         setMostFrequentMood(null);
         if (error.message.includes("Session expired")) {
           router.push("/login");
         }
       } finally {
         setIsLoadingStats(false);
       }
     };
     fetchStats();
  }, [statsPeriod, customDateRange, toast, router]);


  // Fetch Calendar Data
  useEffect(() => {
    const fetchCalendar = async () => {
      setIsLoadingCalendar(true);
      // Use selectedCalendarDate for month/year, default to current date if undefined
      const targetDate = selectedCalendarDate || new Date();
      const currentMonth = targetDate.getMonth() + 1;
      const currentYear = targetDate.getFullYear();
      const params = new URLSearchParams({
         month: currentMonth.toString(),
         year: currentYear.toString(),
      });

      try {
        const response = await fetchAuthenticated<{ calendarData: CalendarData }>(`/api/v1/moods/calendar?${params.toString()}`);
        if (response.status === 'success' && response.data?.calendarData) {
          setCalendarData(response.data.calendarData);
        } else {
          toast({ variant: "destructive", title: "Error", description: response.message || "Could not fetch calendar data." });
          setCalendarData({});
        }
      } catch (error: any) {
         toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch calendar data." });
         setCalendarData({});
         if (error.message.includes("Session expired")) {
           router.push("/login");
         }
      } finally {
         setIsLoadingCalendar(false);
      }
    };
    fetchCalendar();
  }, [selectedCalendarDate, toast, router]); // Re-fetch if selectedCalendarDate changes


   // Fetch Insights Data
   useEffect(() => {
     const fetchInsights = async () => {
       setIsLoadingInsights(true);
       try {
         // Assuming insights endpoint doesn't need params for now
         const response = await fetchAuthenticated<{ insights: MoodInsights }>(`/api/v1/moods/insights`);
         if (response.status === 'success' && response.data) {
           // Adjust based on actual response structure
           setMoodInsights((response.data as any).data || response.data);
         } else {
           // Don't show error toast for insights, maybe just log or show info message
           console.info("Could not fetch mood insights:", response.message);
           setMoodInsights(null);
         }
       } catch (error: any) {
         console.error("Failed to fetch mood insights:", error.message);
         setMoodInsights(null);
         if (error.message.includes("Session expired")) {
           router.push("/login");
         }
       } finally {
         setIsLoadingInsights(false);
       }
     };
     fetchInsights();
   }, [toast, router]); // Fetch once on mount


   // Wrap calendar fetch logic into a callable function
   const fetchCalendarData = useCallback(async (targetDate: Date) => {
      setIsLoadingCalendar(true);
      const currentMonth = targetDate.getMonth() + 1;
      const currentYear = targetDate.getFullYear();
      const params = new URLSearchParams({
         month: currentMonth.toString(),
         year: currentYear.toString(),
      });

      try {
        const response = await fetchAuthenticated<{ calendarData: CalendarData }>(`/api/v1/moods/calendar?${params.toString()}`);
        if (response.status === 'success' && response.data?.calendarData) {
          setCalendarData(response.data.calendarData);
        } else {
          // Don't toast error here if called from log mood, maybe handle differently
          console.error("Could not fetch calendar data:", response.message);
          setCalendarData({});
        }
      } catch (error: any) {
         console.error("Failed to fetch calendar data:", error.message);
         setCalendarData({});
         // Avoid redundant toast/redirect if called after another failed API call
         // if (error.message.includes("Session expired")) {
         //   router.push("/login");
         // }
      } finally {
         setIsLoadingCalendar(false);
      }
   }, [toast, router]); // Dependencies for fetchCalendarData

   // Handler to log today's mood
   const handleLogTodayMood = async (moodTypeId: string) => {
     setIsLoggingMood(moodTypeId); // Set the ID of the mood being logged
     const today = new Date();
     const todayStr = format(today, "yyyy-MM-dd");
     const selectedMoodType = moodTypes.find(m => m._id === moodTypeId); // Find the full mood type object

     if (!selectedMoodType) {
       toast({ variant: "destructive", title: "Error", description: "Selected mood type not found." });
       setIsLoggingMood(null);
       return;
     }

     try {
       const response = await fetchAuthenticated("/api/v1/moods", {
         method: "POST",
         body: JSON.stringify({
           moodTypeId: moodTypeId,
           date: today.toISOString(), // Send today's date
           // Add intensity or notes if your UI supports them
         }),
       });

       if (response.status === "success") {
         toast({
           title: "Mood Logged",
           description: "Your mood for today has been recorded.",
         });
         // Optimistically update calendar data for instant feedback
         setCalendarData(prevData => {
           const newData = { ...prevData };
           const newEntry: CalendarMoodEntry = {
             // Assuming the backend returns the created mood object in response.data.mood
             // If not, construct it manually. For now, using placeholder ID and selectedMoodType
             id: response.data?.mood?._id || `temp-${Date.now()}`, // Use returned ID or temp
             moodType: selectedMoodType,
             // Add intensity/notes if applicable
           };
           // Replace today's entry or add it. Assuming only one mood per day for this card.
           newData[todayStr] = [newEntry];
           return newData;
         });
         // Optionally, still trigger a background refetch for consistency, but UI updates instantly
         // fetchCalendarData(selectedCalendarDate || new Date());
       } else {
         toast({
           variant: "destructive",
           title: "Log failed",
           description: response.message || "Could not log mood.",
         });
       }
     } catch (error: any) {
       toast({
         variant: "destructive",
         title: "API Error",
         description: error.message || "Failed to log mood.",
       });
       if (error.message.includes("Session expired")) {
         router.push("/login");
       }
     } finally {
       setIsLoggingMood(null); // Reset logging state regardless of outcome
     }
   };

   // Modify useEffect for initial calendar fetch
   useEffect(() => {
     fetchCalendarData(selectedCalendarDate || new Date());
   }, [selectedCalendarDate, fetchCalendarData]); // Use fetchCalendarData


  // Handler for changing stats period tab
  const handleTabChange = (value: string) => {
    setStatsPeriod(value);
  };

   // Type guard for DateRange
   const isDateRange = (value: any): value is { from?: Date; to?: Date } => {
     return typeof value === 'object' && value !== null && ('from' in value || 'to' in value);
   }

   // Handler for custom date range selection
   const handleCustomDateRangeSelect = (range: import("react-day-picker").DateRange | undefined) => {
     setCustomDateRange({
        from: range?.from,
        to: range?.to,
     });
     // Automatically switch tab to custom if a range is selected
     if (range?.from || range?.to) {
        setStatsPeriod('custom');
     }
   };

   // Prepare data for MoodChart component
   const chartData = moodStats.map(stat => ({
      mood: stat.moodType.name, // Changed 'name' to 'mood'
      count: stat.count,
      emoji: stat.moodType.emoji, // Added emoji
      // fill is likely handled internally by MoodChart or not needed directly
   }));

   // Get today's mood from calendar data
   const todayStr = format(new Date(), "yyyy-MM-dd");
   const todaysMoodEntries = calendarData[todayStr] || [];
   // Assuming we only care about the first mood recorded for the day for the "Today's Mood" card
   const todaysMood = todaysMoodEntries.length > 0 ? todaysMoodEntries[0].moodType : null;


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mood Tracker</h1>
        <p className="text-muted-foreground">Track and analyze your emotional patterns over time.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Today's Mood Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Today's Mood</CardTitle>
            <CardDescription>How are you feeling today?</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMoodTypes || isLoadingCalendar ? (
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-24 rounded-full" />
                <Skeleton className="h-10 w-20 rounded-full" />
                <Skeleton className="h-10 w-28 rounded-full" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {moodTypes.map((mood) => (
                  <Button
                    key={mood._id}
                    variant="outline"
                    // Highlight button if it matches today's recorded mood
                    className={`h-10 px-3 ${todaysMood?._id === mood._id ? getMoodColorClass(mood.colorCode) : ""}`}
                    onClick={() => handleLogTodayMood(mood._id)}
                    disabled={!!isLoggingMood} // Disable all buttons while any mood is being logged
                  >
                    {isLoggingMood === mood._id ? ( // Show loader only on the button being logged
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <span className="mr-1 text-base">{mood.emoji}</span>
                    )}
                    <span>{mood.name}</span>
                  </Button>
                ))}
                 {moodTypes.length === 0 && <p className="text-sm text-muted-foreground">No mood types found.</p>}
                 {moodTypes.length > 0 && !todaysMood && <p className="text-sm text-muted-foreground">No mood logged today.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Most Frequent Mood Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Most Frequent Mood</CardTitle>
            <CardDescription>In the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="flex items-center gap-2">
                 <Skeleton className="h-12 w-12 rounded-full" />
                 <div className="space-y-1">
                   <Skeleton className="h-5 w-20" />
                   <Skeleton className="h-4 w-28" />
                 </div>
              </div>
            ) : mostFrequentMood ? (
              <div className="flex items-center gap-2">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getMoodColorClass(mostFrequentMood.colorCode)} text-2xl`}>
                  {mostFrequentMood.emoji}
                </div>
                <div>
                  <p className="font-medium">{mostFrequentMood.name}</p>
                  {/* Find count from moodStats */}
                  <p className="text-sm text-muted-foreground">
                     {moodStats.find(s => s.moodType.id === mostFrequentMood.id)?.count || 0} entries
                  </p>
                </div>
              </div>
            ) : (
               <p className="text-sm text-muted-foreground">No mood data for this period.</p>
            )}
          </CardContent>
        </Card>

        {/* Custom Date Range Card */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>Date Range</CardTitle>
            <CardDescription>Select a time period to analyze</CardDescription>
          </CardHeader>
          <CardContent>
             {/* Popover for Custom Date Range Selection */}
             <Popover>
               <PopoverTrigger asChild>
                 <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${!customDateRange.from ? 'text-muted-foreground' : ''}`}
                    // No disabled attribute needed here
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange.from ? (
                     customDateRange.to ? (
                       <>
                         {format(customDateRange.from, "LLL dd, y")} - {format(customDateRange.to, "LLL dd, y")}
                       </>
                     ) : (
                       format(customDateRange.from, "LLL dd, y")
                     )
                   ) : (
                     <span>Select custom range</span>
                   )}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  // Ensure 'selected' is either a valid DateRange ({from: Date, to?: Date}) or undefined
                  selected={customDateRange.from ? { from: customDateRange.from, to: customDateRange.to } : undefined}
                  onSelect={handleCustomDateRangeSelect}
                  initialFocus
                  numberOfMonths={2} // Show two months for easier range selection
                />
               </PopoverContent>
             </Popover>
          </CardContent>
        </Card>
      </div>

      {/* Mood Distribution Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Mood Distribution</CardTitle>
              <CardDescription>
                 {/* Dynamically show date range based on selected period */}
                 {statsPeriod === 'week' && `Last 7 Days`}
                 {statsPeriod === 'month' && `Last Month`}
                 {statsPeriod === '3months' && `Last 3 Months`}
                 {statsPeriod === 'custom' && customDateRange.from && customDateRange.to &&
                   `${format(customDateRange.from, "MMM d, yyyy")} - ${format(customDateRange.to, "MMM d, yyyy")}`
                 }
                 {statsPeriod === 'custom' && !(customDateRange.from && customDateRange.to) && `Custom Range`}
              </CardDescription>
            </div>
            <Tabs defaultValue="month" value={statsPeriod} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="3months">3 Months</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
             <Skeleton className="h-[300px] w-full" />
          ) : chartData.length > 0 ? (
             <MoodChart data={chartData} />
          ) : (
             <p className="text-center text-muted-foreground">No mood data available for the selected period.</p>
          )}
        </CardContent>
      </Card>

      {/* Mood Calendar Card */}
      <Card>
        <CardHeader>
          <CardTitle>Mood Calendar</CardTitle>
          <CardDescription>View your daily moods at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCalendar || isLoadingMoodTypes ? (
             <div className="flex justify-center"><Skeleton className="h-[300px] w-[350px]" /></div>
          ) : (
            <div className="flex items-center justify-center">
              <Calendar
                mode="single"
                selected={selectedCalendarDate}
                onSelect={setSelectedCalendarDate}
                month={selectedCalendarDate} // Control displayed month
                onMonthChange={setSelectedCalendarDate} // Allow month navigation
                className="rounded-md border"
                modifiers={{
                  moodDay: (date) => format(date, "yyyy-MM-dd") in calendarData,
                }}
                modifiersClassNames={{
                   moodDay: 'relative', // Needed for absolute positioning of emoji
                }}
                components={{
                  DayContent: ({ date, activeModifiers }) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const dayEntries = calendarData[dateStr];
                    // Display first mood emoji if multiple moods logged for a day
                    const mood = dayEntries && dayEntries.length > 0 ? dayEntries[0].moodType : null;

                    return (
                      <div className="relative flex h-full w-full items-center justify-center">
                         {/* Display date number */}
                         <span>{date.getDate()}</span>
                         {/* Display mood emoji if present */}
                         {mood && (
                           <span
                             className="absolute bottom-0 right-0 text-xs"
                             title={mood.name}
                           >
                             {mood.emoji}
                           </span>
                         )}
                      </div>
                    );
                  },
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mood Insights Card */}
      <Card>
        <CardHeader>
          <CardTitle>Mood Insights</CardTitle>
          <CardDescription>Understanding your emotional patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingInsights ? (
             <div className="space-y-4">
               <Skeleton className="h-5 w-1/4" />
               <Skeleton className="h-4 w-full" />
               <Skeleton className="h-4 w-5/6" />
               <Skeleton className="h-5 w-1/3 mt-4" />
               <Skeleton className="h-4 w-full" />
               <Skeleton className="h-4 w-full" />
             </div>
          ) : moodInsights ? (
            <>
              <div className="space-y-2">
                <h3 className="font-medium">Your mood trends ({moodInsights.period})</h3>
                <p className="text-sm text-muted-foreground">
                  You recorded {moodInsights.totalMoodsRecorded} moods during this period.
                  {mostFrequentMood && ` Your most frequent mood was ${mostFrequentMood.name.toLowerCase()}.`}
                  Try to notice what activities or situations are associated with your different moods.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Tips for emotional well-being</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  <li>Regular journaling helps identify emotional patterns</li>
                  <li>Notice connections between your activities and moods</li>
                  <li>Practice mindfulness to better understand your emotions</li>
                  <li>Consider what helps improve your mood on difficult days</li>
                </ul>
              </div>
            </>
          ) : (
             <p className="text-center text-muted-foreground">Mood insights are currently unavailable.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
