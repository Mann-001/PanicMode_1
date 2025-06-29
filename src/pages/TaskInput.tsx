
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Calendar as CalendarIcon, Edit } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  name: string;
  deadline: Date;
  weightage: number;
  totalTime?: number;
  dailyTime?: number;
}

const TaskInput = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState({
    name: "",
    deadline: undefined as Date | undefined,
    weightage: 5,
    totalTime: "",
    dailyTime: "",
    timeType: "total" as "total" | "daily"
  });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedTasks = localStorage.getItem("panicmode_tasks");
    if (savedTasks) {
      const parsedTasks = JSON.parse(savedTasks);
      // Convert date strings back to Date objects
      const tasksWithDates = parsedTasks.map((task: any) => ({
        ...task,
        deadline: new Date(task.deadline)
      }));
      setTasks(tasksWithDates);
    }
  }, []);

  const saveTasks = (updatedTasks: Task[]) => {
    localStorage.setItem("panicmode_tasks", JSON.stringify(updatedTasks));
    setTasks(updatedTasks);
  };

  const handleAddTask = () => {
    if (!newTask.name || !newTask.deadline) {
      toast({
        title: "Please fill in required fields",
        description: "Task name and deadline are required",
        variant: "destructive",
      });
      return;
    }

    const timeValue = newTask.timeType === "total" ? newTask.totalTime : newTask.dailyTime;
    if (!timeValue || parseFloat(timeValue) <= 0) {
      toast({
        title: "Please enter a valid time",
        description: "Either total time or daily time must be specified",
        variant: "destructive",
      });
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      name: newTask.name,
      deadline: newTask.deadline,
      weightage: newTask.weightage,
      ...(newTask.timeType === "total" 
        ? { totalTime: parseFloat(newTask.totalTime) }
        : { dailyTime: parseFloat(newTask.dailyTime) }
      )
    };

    const updatedTasks = [...tasks, task];
    saveTasks(updatedTasks);
    setNewTask({
      name: "",
      deadline: undefined,
      weightage: 5,
      totalTime: "",
      dailyTime: "",
      timeType: "total"
    });
    
    toast({
      title: "Task added!",
      description: `${newTask.name} has been added to your task list`,
    });
  };

  const handleEditTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      setNewTask({
        name: task.name,
        deadline: task.deadline,
        weightage: task.weightage,
        totalTime: task.totalTime?.toString() || "",
        dailyTime: task.dailyTime?.toString() || "",
        timeType: task.totalTime ? "total" : "daily"
      });
      setIsEditing(id);
    }
  };

  const handleUpdateTask = () => {
    if (!newTask.name || !newTask.deadline) {
      toast({
        title: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    const timeValue = newTask.timeType === "total" ? newTask.totalTime : newTask.dailyTime;
    if (!timeValue || parseFloat(timeValue) <= 0) {
      toast({
        title: "Please enter a valid time",
        variant: "destructive",
      });
      return;
    }

    const updatedTasks = tasks.map(task =>
      task.id === isEditing
        ? {
            ...task,
            name: newTask.name,
            deadline: newTask.deadline!,
            weightage: newTask.weightage,
            totalTime: newTask.timeType === "total" ? parseFloat(newTask.totalTime) : undefined,
            dailyTime: newTask.timeType === "daily" ? parseFloat(newTask.dailyTime) : undefined
          }
        : task
    );

    saveTasks(updatedTasks);
    setNewTask({
      name: "",
      deadline: undefined,
      weightage: 5,
      totalTime: "",
      dailyTime: "",
      timeType: "total"
    });
    setIsEditing(null);
    
    toast({
      title: "Task updated!",
    });
  };

  const handleDeleteTask = (id: string) => {
    const updatedTasks = tasks.filter(task => task.id !== id);
    saveTasks(updatedTasks);
    
    toast({
      title: "Task removed",
    });
  };

  const handleContinue = () => {
    if (tasks.length === 0) {
      toast({
        title: "Add at least one task",
        description: "We need tasks to generate your study schedule",
        variant: "destructive",
      });
      return;
    }

    navigate("/schedule");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-2">
            What do you need to get done?
          </h1>
          <p className="text-gray-600">
            Add your tasks with deadlines and time requirements
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Add Task Form */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-600">
                <Plus className="h-5 w-5" />
                {isEditing ? "Edit Task" : "Add Task"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Task Name *
                </label>
                <Input
                  placeholder="e.g., Math Assignment, History Essay"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  className="border-teal-200 focus:border-teal-400"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Deadline *
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-teal-200",
                        !newTask.deadline && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newTask.deadline ? format(newTask.deadline, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newTask.deadline}
                      onSelect={(date) => setNewTask({ ...newTask, deadline: date })}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Priority (1-10)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={newTask.weightage}
                  onChange={(e) => setNewTask({ ...newTask, weightage: parseInt(e.target.value) || 5 })}
                  className="border-teal-200 focus:border-teal-400"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 block">
                  Time Requirement *
                </label>
                
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="timeType"
                      value="total"
                      checked={newTask.timeType === "total"}
                      onChange={(e) => setNewTask({ ...newTask, timeType: e.target.value as "total" | "daily" })}
                      className="mr-2 text-teal-500"
                    />
                    Total Time (hours)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="timeType"
                      value="daily"
                      checked={newTask.timeType === "daily"}
                      onChange={(e) => setNewTask({ ...newTask, timeType: e.target.value as "total" | "daily" })}
                      className="mr-2 text-teal-500"
                    />
                    Daily Time (hours)
                  </label>
                </div>

                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  placeholder={newTask.timeType === "total" ? "Total hours needed" : "Hours per day"}
                  value={newTask.timeType === "total" ? newTask.totalTime : newTask.dailyTime}
                  onChange={(e) => setNewTask({ 
                    ...newTask, 
                    [newTask.timeType === "total" ? "totalTime" : "dailyTime"]: e.target.value 
                  })}
                  className="border-teal-200 focus:border-teal-400"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={isEditing ? handleUpdateTask : handleAddTask}
                  className="flex-1 bg-teal-500 hover:bg-teal-600"
                >
                  {isEditing ? "Update Task" : "Add Task"}
                </Button>
                {isEditing && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditing(null);
                      setNewTask({
                        name: "",
                        deadline: undefined,
                        weightage: 5,
                        totalTime: "",
                        dailyTime: "",
                        timeType: "total"
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-600">
                <CalendarIcon className="h-5 w-5" />
                Your Tasks ({tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No tasks added yet. Start by adding your first task!
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {tasks.map((task) => (
                    <div 
                      key={task.id}
                      className="p-4 bg-teal-50 rounded-lg border border-teal-100"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-800">{task.name}</h4>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditTask(task.id)}
                            className="text-teal-600 hover:text-teal-700 hover:bg-teal-100 p-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Due: {format(task.deadline, "PPP")}</p>
                        <p>Priority: {task.weightage}/10</p>
                        <p>
                          {task.totalTime 
                            ? `Total: ${task.totalTime} hours` 
                            : `Daily: ${task.dailyTime} hours`
                          }
                        </p>
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
            Generate Schedule
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TaskInput;
