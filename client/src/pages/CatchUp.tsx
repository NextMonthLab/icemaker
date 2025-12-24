import Layout from "@/components/Layout";
import { MOCK_CARDS } from "@/lib/mockData";
import { Link } from "wouter";
import { CheckCircle2, Lock, StickyNote, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default function CatchUp() {
  return (
    <Layout>
      <div className="p-4 pt-8 md:p-8 max-w-md mx-auto animate-in fade-in duration-500">
        <h1 className="text-3xl font-display font-bold mb-6">Case Journal</h1>

        <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="clues">Clues & Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
                {/* Timeline Line */}
                <div className="absolute left-8 top-48 bottom-0 w-px bg-border -z-10 hidden md:block" />

                {MOCK_CARDS.map((card, index) => (
                    <Link key={card.id} href={index === 0 ? "/today" : "#"}>
                        <div className="group relative flex gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors cursor-pointer overflow-hidden">
                            {/* Thumbnail */}
                            <div className="w-20 h-32 flex-shrink-0 rounded-md overflow-hidden bg-black relative">
                                <img src={card.image} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" />
                                {index === 0 && (
                                    <div className="absolute inset-0 bg-primary/20 ring-2 ring-primary inset-0" />
                                )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-primary tracking-wider uppercase">Day {card.dayIndex}</span>
                                    {index === 0 ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                                </div>
                                <h3 className="text-xl font-display font-bold mb-2 group-hover:text-primary transition-colors">{card.title}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">{card.recapText}</p>
                            </div>
                        </div>
                    </Link>
                ))}
                
                {/* Locked Future Cards */}
                {[4, 5, 6].map((day) => (
                    <div key={day} className="flex gap-4 p-4 rounded-lg border border-white/5 bg-white/5 opacity-50 cursor-not-allowed">
                        <div className="w-20 h-32 flex-shrink-0 rounded-md bg-white/5 flex items-center justify-center">
                            <Lock className="w-6 h-6 text-white/20" />
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Day {day}</span>
                            <h3 className="text-xl font-display font-bold mb-2 text-muted-foreground">Locked</h3>
                        </div>
                    </div>
                ))}
            </TabsContent>

            <TabsContent value="clues" className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    {/* Mock Clues */}
                    <Card className="bg-yellow-100/10 border-yellow-500/20 rotate-1 hover:rotate-0 transition-transform cursor-pointer">
                        <CardContent className="p-4 space-y-2">
                             <StickyNote className="w-5 h-5 text-yellow-500" />
                             <p className="font-handwriting text-sm italic text-yellow-100/80">
                                "The package had a Militech stamp on the bottom. V pretended not to see it."
                             </p>
                             <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Added Day 1</span>
                        </CardContent>
                    </Card>

                     <Card className="bg-blue-900/20 border-blue-500/20 -rotate-1 hover:rotate-0 transition-transform cursor-pointer">
                        <CardContent className="p-4 space-y-2">
                             <FileText className="w-5 h-5 text-blue-400" />
                             <p className="font-mono text-xs text-blue-200">
                                ENC_KEY: 77-A-9F
                                [PARTIAL DECRYPT]
                                ...project cynosure...
                             </p>
                             <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Added Day 2</span>
                        </CardContent>
                    </Card>
                 </div>

                 <div className="p-4 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground h-32 opacity-50">
                    <Lock className="w-6 h-6 mb-2" />
                    <span className="text-xs uppercase font-bold">More clues hidden in chat</span>
                 </div>
            </TabsContent>
        </Tabs>

      </div>
    </Layout>
  );
}
