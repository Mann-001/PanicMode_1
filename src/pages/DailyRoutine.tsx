
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Clock, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RoutineActivity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

const DailyRoutine = () => {
  const [activities, setActivities] = useState<RoutineActivity[]>([]);
  const [newActivity, setNewActivity] = useState({
    name: "",
    startTime: "",
    endTime: ""
  });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedRoutine = localStorage.getItem("panicmode_routine");
    if (savedRoutine) {
      setActivities(JSON.parse(savedRoutine));
    }
  }, []);

  const saveRoutine = (updatedActivities: RoutineActivity[]) => {
    localStorage.setItem("panicmode_routine", JSON.stringify(updatedActivities));
    setActivities(updatedActivities);
  };

  const handleAddActivity = () => {
    if (!newActivity.name || !newActivity.startTime || !newActivity.endTime) {
      toast({
        title: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (newActivity.startTime >= newActivity.endTime) {
      toast({
        title: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    const activity: RoutineActivity = {
      id: Date.now().toString(),
      ...newActivity
    };

    const updatedActivities = [...activities, activity];
    saveRoutine(updatedActivities);
    setNewActivity({ name: "", startTime: "", endTime: "" });
    
    toast({
      title: "Activity added!",
      description: `${newActivity.name} has been added to your routine`,
    });
  };

  const handleEditActivity = (id: string) => {
    const activity = activities.find(a => a.id === id);
    if (activity) {
      setNewActivity(activity);
      setIsEditing(id);
    }
  };

  const handleUpdateActivity = () => {
    if (!newActivity.name || !newActivity.startTime || !newActivity.endTime) {
      toast({
        title: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const updatedActivities = activities.map(activity =>
      activity.id === isEditing
        ? { ...activity, ...newActivity }
        : activity
    );

    saveRoutine(updatedActivities);
    setNewActivity({ name: "", startTime: "", endTime: "" });
    setIsEditing(null);
    
    toast({
      title: "Activity updated!",
    });
  };

  const handleDeleteActivity = (id: string) => {
    const updatedActivities = activities.filter(activity => activity.id !== id);
    saveRoutine(updatedActivities);
    
    toast({
      title: "Activity removed",
    });
  };

  const handleContinue = () => {
    if (activities.length === 0) {
      toast({
        title: "Add at least one activity",
        description: "Your routine helps us find free time for studying",
        variant: "destructive",
      });
      return;
    }

    navigate("/tasks");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-2">
            Tell us about your daily routine
          </h1>
          <p className="text-gray-600">
            Add your fixed activities so we can find the best study times
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Add Activity Form */}
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
                  placeholder="e.g., Sleep, Breakfast, Gym"
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
                  className="flex-1 bg-teal-500 hover:bg-teal-600"
                >
                  {isEditing ? "Update Activity" : "Add Activity"}
                </Button>
                {isEditing && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditing(null);
                      setNewActivity({ name: "", startTime: "", endTime: "" });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activities List */}
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
                  No activities added yet. Start by adding your daily routine!
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
                          className="text-teal-600 hover:text-teal-700 hover:bg-teal-100"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteActivity(activity.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
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

        <div className="text-center mt-8">
          <Button 
            onClick={handleContinue}
            className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-3 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Continue to Tasks
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DailyRoutine;
