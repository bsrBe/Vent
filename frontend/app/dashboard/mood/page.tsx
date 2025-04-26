"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO } from "date-fns" // Removed subDays, subMonths, CalendarIcon
import { Loader2 } from "lucide-react" // Removed CalendarIcon
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// Removed Tabs imports
import { Calendar } from "@/components/ui/calendar"
// Removed Popover imports
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
  // Removed statsPeriod and customDateRange state

  // State for fetched data
  const [moodStats, setMoodStats] = useState<MoodStat[]>([]);
  const [mostFrequentMoods, setMostFrequentMoods] = useState<(MoodStat['moodType'])[]>([]); // Changed to array for ties
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


  // Fetch Stats Data (simplified - assuming backend defaults period or uses a fixed one like 'month')
  useEffect(() => {
     const fetchStats = async () => {
       setIsLoadingStats(true);
       // No period/date params sent, backend will use its default (e.g., 'month')
       try {
         // Expecting potentially multiple most frequent moods now
         const response = await fetchAuthenticated<{
            mostFrequentMoods: (MoodStat['moodType'])[]; // Expecting array
            moodCounts: MoodStat[];
            // dateRange might still be returned by backend for context
         }>(`/api/v1/moods/stats`); // Removed params

         if (response.status === 'success' && response.data) {
           setMoodStats(response.data.moodCounts || []);
           setMostFrequentMoods(response.data.mostFrequentMoods || []); // Set array
         } else {
           toast({ variant: "destructive", title: "Error", description: response.message || "Could not fetch mood stats." });
           setMoodStats([]);
           setMostFrequentMoods([]); // Reset array
         }
       } catch (error: any) {
         toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch mood stats." });
         setMoodStats([]);
         setMostFrequentMoods([]); // Reset array
         if (error.message.includes("Session expired")) {
           router.push("/login");
         }
       } finally {
         setIsLoadingStats(false);
       }
     };
     fetchStats();
  }, [toast, router]); // Dependencies updated


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


  // Removed handleTabChange and handleCustomDateRangeSelect handlers

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

      {/* Adjusted grid layout since one card is removed */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Most Frequent Mood Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Most Frequent Mood</CardTitle>
            <CardDescription>Based on last month's entries</CardDescription> {/* Updated description */}
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
            ) : mostFrequentMoods.length > 0 ? (
              // Display multiple moods if there's a tie
              mostFrequentMoods.map((mood, index) => (
                <div key={mood.id} className={`flex items-center gap-2 ${index > 0 ? 'mt-2' : ''}`}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getMoodColorClass(mood.colorCode)} text-2xl`}>
                    {mood.emoji}
                  </div>
                  <div>
                    <p className="font-medium">{mood.name}</p>
                    {/* Find count from moodStats */}
                    <p className="text-sm text-muted-foreground">
                       {moodStats.find(s => s.moodType.id === mood.id)?.count || 0} entries
                    </p>
                  </div>
                </div>
              ))
            ) : (
               <p className="text-sm text-muted-foreground">No mood data found for the last month.</p>
            )}
          </CardContent>
        </Card>

        {/* Removed Date Range Card */}
      </div>

      {/* Mood Distribution Card */}
      <Card>
        <CardHeader>
          {/* Removed outer flex div and Tabs component */}
          <div>
            <CardTitle>Mood Distribution</CardTitle>
            <CardDescription>Based on last month's entries</CardDescription> {/* Updated description */}
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
                  {/* Updated to handle multiple most frequent moods */}
                  {mostFrequentMoods.length === 1 && ` Your most frequent mood was ${mostFrequentMoods[0].name.toLowerCase()}.`}
                  {mostFrequentMoods.length > 1 && ` Your most frequent moods were ${mostFrequentMoods.map(m => m.name.toLowerCase()).join(', ')}.`}
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
