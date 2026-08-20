import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ScheduleItem {
  id: string;
  taskId: string;
  taskName: string;
  day: string;
  startTime: string;
  endTime: string;
  duration: number;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const parseTime = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes || 0) / 60;
};

const formatTime = (timeNum: number): string => {
  const hours = Math.floor(timeNum);
  const minutes = Math.round((timeNum - hours) * 60);
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  return `${formattedHours}:${formattedMinutes}`;
};

const AutoReschedule = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const savedSchedule = localStorage.getItem("panicmode_schedule");
    if (savedSchedule) {
      try {
        setSchedule(JSON.parse(savedSchedule));
      } catch (e) {
        console.error("Failed to parse schedule", e);
      }
    }
  }, []);

  // Helper to find the next free slot for a session
  const findNextSlot = (
    sessionToMove: ScheduleItem,
    currentSchedule: ScheduleItem[],
    startDayIndex: number,
    minStartTime: number = 9
  ): ScheduleItem | null => {
    for (let i = startDayIndex; i < daysOfWeek.length; i++) {
      const targetDay = daysOfWeek[i];
      const daySessions = currentSchedule
        .filter(s => s.day === targetDay)
        .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

      let availableStartTime = i === startDayIndex ? minStartTime : 9;

      for (const existingSession of daySessions) {
        const start = parseTime(existingSession.startTime);
        const end = parseTime(existingSession.endTime);

        if (start - availableStartTime >= sessionToMove.duration) {
          break;
        }
        if (end > availableStartTime) {
          availableStartTime = end;
        }
      }

      if (availableStartTime + sessionToMove.duration <= 22) {
        return {
          ...sessionToMove,
          id: `${sessionToMove.taskId}-rescheduled-${Date.now()}-${Math.random()}`,
          day: targetDay,
          startTime: formatTime(availableStartTime),
          endTime: formatTime(availableStartTime + sessionToMove.duration)
        };
      }
    }
    return null;
  };

  const handleMarkMissed = (sessionId: string) => {
    const session = schedule.find(s => s.id === sessionId);
    if (!session) return;

    const remainingSchedule = schedule.filter(s => s.id !== sessionId);
    const currentDayIndex = daysOfWeek.indexOf(session.day);
    const minStart = parseTime(session.endTime);

    const rescheduledSession = findNextSlot(session, remainingSchedule, currentDayIndex, minStart);

    if (rescheduledSession) {
      const updatedSchedule = [...remainingSchedule, rescheduledSession];
      setSchedule(updatedSchedule);
      localStorage.setItem("panicmode_schedule", JSON.stringify(updatedSchedule));
      toast({
        title: "Session Rescheduled!",
        description: `Moved "${session.taskName}" to ${rescheduledSession.day} at ${rescheduledSession.startTime}.`,
      });
    } else {
      toast({
        title: "No Open Slots Found",
        description: "Could not find a free slot before Sunday 10 PM.",
        variant: "destructive"
      });
    }
  };

  const handleMarkUnavailable = (day: string, timeSlot: string) => {
    const sessionsToReschedule = schedule.filter(
      s => s.day === day && s.startTime === timeSlot
    );

    if (sessionsToReschedule.length === 0) return;

    let updatedSchedule = schedule.filter(
      s => !(s.day === day && s.startTime === timeSlot)
    );

    const dayIndex = daysOfWeek.indexOf(day);
    const unavailStart = parseTime(timeSlot);

    let count = 0;
    for (const session of sessionsToReschedule) {
      // Find new slot starting after the unavailable time or on upcoming days
      const rescheduled = findNextSlot(
        session,
        updatedSchedule,
        dayIndex,
        unavailStart + session.duration
      ) || findNextSlot(session, updatedSchedule, dayIndex + 1, 9);

      if (rescheduled) {
        updatedSchedule.push(rescheduled);
        count++;
      }
    }

    setSchedule(updatedSchedule);
    localStorage.setItem("panicmode_schedule", JSON.stringify(updatedSchedule));

    toast({
      title: "Tasks Rescheduled!",
      description: `${count} task(s) moved to new available slots instead of being deleted.`,
    });
  };

  const handleRegenerateSchedule = () => {
    toast({
      title: "Redirecting to Schedule Generator",
      description: "Recalculating your timeline based on your tasks...",
    });
    navigate("/schedule");
  };

  const groupedSchedule = schedule.reduce((acc, session) => {
    if (!acc[session.day]) {
      acc[session.day] = [];
    }
    acc[session.day].push(session);
    return acc;
  }, {} as Record<string, ScheduleItem[]>);

  if (schedule.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 flex items-center justify-center p-4">
        <Card className="max-w-md shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="text-center p-8">
            <h2 className="text-2xl font-bold text-teal-600 mb-4">No Schedule Found</h2>
            <p className="text-gray-600 mb-6">
              Generate a schedule first to use the rescheduling feature.
            </p>
            <Button 
              onClick={() => navigate("/schedule")}
              className="bg-teal-500 hover:bg-teal-600"
            >
              Generate Schedule
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-2">
            Smart Rescheduling
          </h1>
          <p className="text-gray-600 mb-4">
            Mark sessions as missed or unavailable—tasks are automatically moved to free slots without deletion.
          </p>
          <Button
            onClick={handleRegenerateSchedule}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-md"
          >
            <RefreshCw className="h-4 w-4" />
            Recalculate & Rebalance Schedule
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {daysOfWeek.map(day => {
            const daySessions = groupedSchedule[day] || [];
            
            return (
              <Card key={day} className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-teal-600 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {day}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {daySessions.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4">No sessions scheduled</p>
                  ) : (
                    daySessions.map(session => (
                      <div 
                        key={session.id}
                        className="p-3 bg-teal-50 rounded-lg border border-teal-200"
                      >
                        <div className="font-medium text-gray-800 mb-2">
                          {session.taskName}
                        </div>
                        <div className="text-sm text-gray-600 flex items-center gap-1 mb-3">
                          <Clock className="h-3 w-3" />
                          {session.startTime} - {session.endTime}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkMissed(session.id)}
                            className="flex-1 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                          >
                            Missed
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkUnavailable(session.day, session.startTime)}
                            className="flex-1 text-xs border-red-300 text-red-600 hover:bg-red-50"
                          >
                            Unavailable
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center gap-4 mt-8">
          <Button 
            onClick={() => navigate("/schedule")}
            className="bg-teal-500 hover:bg-teal-600 flex items-center gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            Back to Main Schedule
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AutoReschedule;