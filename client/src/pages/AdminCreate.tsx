import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { addMockCard } from "@/lib/mockData";
import { useToast } from "@/hooks/use-toast";

export default function AdminCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    dayIndex: 4,
    publishDate: new Date().toISOString().slice(0, 16),
    title: "",
    image: "",
    caption1: "",
    caption2: "",
    caption3: "",
    sceneText: "",
  });

  const handleSave = () => {
    // Basic validation
    if (!formData.title) {
        toast({ title: "Error", description: "Title is required", variant: "destructive" });
        return;
    }

    const newCard = {
        id: `card_${Date.now()}`,
        dayIndex: Number(formData.dayIndex),
        title: formData.title,
        image: formData.image || "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1080&h=1920&fit=crop", // Default placeholder
        captions: [formData.caption1, formData.caption2, formData.caption3].filter(Boolean),
        sceneText: formData.sceneText,
        recapText: `Day ${formData.dayIndex} - ${formData.title}`,
        publishDate: formData.publishDate + ":00Z",
    };

    addMockCard(newCard);
    
    toast({ title: "Success", description: "Card scheduled successfully." });
    setLocation("/catch-up");
  };

  return (
    <Layout>
      <div className="p-8 max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
        
        <div className="flex items-center gap-4">
            <Link href="/admin">
                <Button variant="ghost" size="icon">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
            </Link>
            <h1 className="text-3xl font-display font-bold">Create New Card</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Core Details</CardTitle>
                    <CardDescription>The fundamental metadata for this story drop.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="day">Day Index</Label>
                            <Input 
                                id="day" 
                                type="number" 
                                value={formData.dayIndex}
                                onChange={(e) => setFormData({...formData, dayIndex: Number(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date">Publish Date</Label>
                            <Input 
                                id="date" 
                                type="datetime-local" 
                                value={formData.publishDate}
                                onChange={(e) => setFormData({...formData, publishDate: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="title">Card Title</Label>
                        <Input 
                            id="title" 
                            placeholder="e.g. The Betrayal" 
                            value={formData.title}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="md:col-span-1">
                <CardHeader>
                    <CardTitle>Visual Assets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="aspect-[9/16] bg-muted rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors relative overflow-hidden group">
                        {formData.image ? (
                            <img src={formData.image} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <>
                                <Upload className="w-8 h-8 mb-2" />
                                <span className="text-xs uppercase font-bold">Paste Image URL</span>
                            </>
                        )}
                        <Input 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            type="text"
                            placeholder="Paste Image URL here temporarily"
                            onChange={(e) => {
                                // Simple way to let users paste a URL for the prototype
                                const val = prompt("Paste an image URL (Unsplash, etc):");
                                if(val) setFormData({...formData, image: val});
                            }}
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Click to paste an image URL for preview</p>
                    
                    <div className="space-y-2">
                         <Label>Visual Effect</Label>
                         <Select defaultValue="ken-burns">
                            <SelectTrigger>
                                <SelectValue placeholder="Select effect" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ken-burns">Slow Zoom (Ken Burns)</SelectItem>
                                <SelectItem value="smoke">Noir Smoke Overlay</SelectItem>
                                <SelectItem value="glitch">Cyber Glitch</SelectItem>
                                <SelectItem value="none">Static</SelectItem>
                            </SelectContent>
                         </Select>
                    </div>
                </CardContent>
            </Card>

            <Card className="md:col-span-1">
                <CardHeader>
                    <CardTitle>Narrative Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Overlay Captions (3 lines)</Label>
                        <Input 
                            placeholder="Line 1" 
                            value={formData.caption1}
                            onChange={(e) => setFormData({...formData, caption1: e.target.value})}
                        />
                        <Input 
                            placeholder="Line 2" 
                            value={formData.caption2}
                            onChange={(e) => setFormData({...formData, caption2: e.target.value})}
                        />
                        <Input 
                            placeholder="Line 3" 
                            value={formData.caption3}
                            onChange={(e) => setFormData({...formData, caption3: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Scene Text (Story)</Label>
                        <Textarea 
                            placeholder="The actual story text..." 
                            className="h-32" 
                            value={formData.sceneText}
                            onChange={(e) => setFormData({...formData, sceneText: e.target.value})}
                        />
                    </div>
                </CardContent>
            </Card>

        </div>

        <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setLocation("/admin")}>Cancel</Button>
            <Button className="gap-2 bg-primary text-white hover:bg-primary/90" onClick={handleSave}>
                <Save className="w-4 h-4" /> Save & Schedule
            </Button>
        </div>

      </div>
    </Layout>
  );
}
