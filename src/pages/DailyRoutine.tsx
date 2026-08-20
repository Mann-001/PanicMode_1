import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Clock, Edit, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface RoutineActivity {
  id: string;
  name: string;
  startTime: string; // HH:MM format (24hr)
  endTime: string;   // HH:MM format (24hr)
}

// Convert "HH:MM" to total minutes from 00:00
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Returns normalized intervals [start, end] in minutes.
// If end <= start, it crosses midnight (e.g. 22:00 to 06:00), returning TWO intervals:
// Interval 1: [22:00, 24:00] and Interval 2: [00:00, 06:00]
const getMinutesIntervals = (startStr: string, endStr: string): [number, number][] => {
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);

  if (start < end) {
    return [[start, end]];
  } else {
    // Overnight activity: splits into [start -> 1440] and [0 -> end]
    return [
      [start, 24 * 60],
      [0, end]
    ];
  }
};

// Checks if two activities overlap on a 24-hour cycle
const isOverlapping = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const intervals1 = getMinutesIntervals(start1, end1);
  const intervals2 = getMinutesIntervals(start2, end2);

  for (const [s1, e1] of intervals1) {
    for (const [s2, e2] of intervals2) {
      if (Math.max(s1, s2) < Math.min(e1, e2)) {
        return true;
      }
    }
  }
  return false;
};

const DailyRoutine = () => {
  const [activities, setActivities] = useState<RoutineActivity[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newActivity, setNewActivity] = useState({
    name: "",
    startTime: "22:00",
    endTime: "06:00",
  });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRoutine = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        const { data, error } = await supabase
          .from("routines")
          .select("activities")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching routine:", error);
        } else if (data && data.activities) {
          setActivities(data.activities as RoutineActivity[]);
        }
      }
      setLoading(false);
    };

    fetchRoutine();
  }, []);

  const saveRoutineToSupabase = async (updatedActivities: RoutineActivity[]) => {
    if (!userId) return;

    setSaving(true);
    setActivities(updatedActivities);

    const { error } = await supabase
      .from("routines")
      .upsert({
        user_id: userId,
        activities: updatedActivities,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    setSaving(false);

    if (error) {
      toast({
        title: "Failed to sync routine",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const validateAndCheckOverlap = (): boolean => {
    if (!newActivity.name.trim() || !newActivity.startTime || !newActivity.endTime) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return false;
    }

    if (newActivity.startTime === newActivity.endTime) {
      toast({ title: "Start and end times cannot be identical", variant: "destructive" });
      return false;
    }

    // Check for overlap against all existing activities
    const hasOverlap = activities.some((item) => {
      if (isEditing && item.id === isEditing) return false;
      return isOverlapping(
        newActivity.startTime,
        newActivity.endTime,
        item.startTime,
        item.endTime
      );
    });

    if (hasOverlap) {
      toast({
        title: "Time Slot Conflict!",
        description: "This activity overlaps with another activity in your routine.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleAddActivity = () => {
    if (!validateAndCheckOverlap()) return;

    const activity: RoutineActivity = {
      id: Date.now().toString(),
      name: newActivity.name.trim(),
      startTime: newActivity.startTime,
      endTime: newActivity.endTime,
    };

    const updated = [...activities, activity];
    saveRoutineToSupabase(updated);
    setNewActivity({ name: "", startTime: "09:00", endTime: "10:00" });

    toast({ title: "Activity added successfully!" });
  };

  const handleEditActivity = (id: string) => {
    const activity = activities.find(a => a.id === id);
    if (activity) {
      setNewActivity(activity);
      setIsEditing(id);
    }
  };

  const handleUpdateActivity = () => {
    if (!validateAndCheckOverlap()) return;

    const updated = activities.map(a =>
      a.id === isEditing ? { ...a, ...newActivity } : a
    );

    saveRoutineToSupabase(updated);
    setNewActivity({ name: "", startTime: "09:00", endTime: "10:00" });
    setIsEditing(null);

    toast({ title: "Activity updated!" });
  };

  const handleDeleteActivity = (id: string) => {
    const updated = activities.filter(a => a.id !== id);
    saveRoutineToSupabase(updated);
    toast({ title: "Activity removed" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-2">
            Tell us about your daily routine
          </h1>
          <p className="text-gray-600">
            Add fixed non-overlapping activities (including overnight schedules) so we can optimize your study schedule
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Form */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-teal-600">
                  <Plus className="h-5 w-5" />
                  {isEditing ? "Edit Activity" : "Add Activity"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Activity Name
                  </label>
                  <Input
                    placeholder="e.g., Sleep, Gym, Lunch"
                    value={newActivity.name}
                    onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                    className="border-teal-200 focus:border-teal-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Start Time
                    </label>
                    <Input
                      type="time"
                      value={newActivity.startTime}
                      onChange={(e) => setNewActivity({ ...newActivity, startTime: e.target.value })}
                      className="border-teal-200 focus:border-teal-400"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      End Time
                    </label>
                    <Input
                      type="time"
                      value={newActivity.endTime}
                      onChange={(e) => setNewActivity({ ...newActivity, endTime: e.target.value })}
                      className="border-teal-200 focus:border-teal-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={isEditing ? handleUpdateActivity : handleAddActivity}
                    disabled={saving}
                    className="flex-1 bg-teal-500 hover:bg-teal-600"
                  >
                    {saving ? "Saving..." : isEditing ? "Update Activity" : "Add Activity"}
                  </Button>
                  {isEditing && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsEditing(null);
                        setNewActivity({ name: "", startTime: "09:00", endTime: "10:00" });
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Routine List */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-teal-600">
                  <Clock className="h-5 w-5" />
                  Your Routine ({activities.length} activities)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No activities added yet.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {activities.map((activity) => (
                      <div 
                        key={activity.id}
                        className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-100"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800">{activity.name}</h4>
                          <p className="text-sm text-gray-600">
                            {activity.startTime} - {activity.endTime}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditActivity(activity.id)}
                            className="text-teal-600 hover:bg-teal-100"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteActivity(activity.id)}
                            className="text-red-500 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="text-center mt-8">
          <Button 
            onClick={() => navigate("/tasks")}
            className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-3 text-lg rounded-xl shadow-lg transition-all"
          >
            Continue to Tasks
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DailyRoutine;