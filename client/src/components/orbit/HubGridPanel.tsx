import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  GripVertical, 
  Eye, 
  EyeOff, 
  Pencil, 
  Trash2, 
  Link, 
  FileText, 
  Quote, 
  FileIcon, 
  Sparkles,
  X,
  Check,
  Loader2,
  Package,
  UtensilsCrossed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface OrbitBox {
  id: number;
  businessSlug: string;
  boxType: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  content: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isVisible: boolean;
  iceId: number | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  sku: string | null;
  availability: 'in_stock' | 'out_of_stock' | 'limited' | null;
  popularityScore: number | null;
}

interface HubGridPanelProps {
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
}

const boxTypeIcons = {
  url: Link,
  text: FileText,
  testimonial: Quote,
  pdf: FileIcon,
  ice: Sparkles,
  product: Package,
  menu_item: UtensilsCrossed,
};

const boxTypeLabels = {
  url: 'Link',
  text: 'Text',
  testimonial: 'Testimonial',
  pdf: 'PDF',
  ice: 'ICE Experience',
  product: 'Product',
  menu_item: 'Menu Item',
};

export function HubGridPanel({ businessSlug, planTier }: HubGridPanelProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBox, setEditingBox] = useState<OrbitBox | null>(null);
  const [newBox, setNewBox] = useState({
    boxType: 'url' as keyof typeof boxTypeIcons,
    title: '',
    description: '',
    sourceUrl: '',
    content: '',
  });

  const { data: boxesData, isLoading } = useQuery<{ boxes: OrbitBox[]; isOwner: boolean }>({
    queryKey: ["orbit-boxes", businessSlug],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${businessSlug}/boxes`);
      if (!response.ok) throw new Error("Failed to fetch boxes");
      return response.json();
    },
  });

  const createBoxMutation = useMutation({
    mutationFn: async (data: typeof newBox) => {
      const response = await fetch(`/api/orbit/${businessSlug}/boxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create box");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orbit-boxes", businessSlug] });
      setShowAddModal(false);
      setNewBox({ boxType: 'url', title: '', description: '', sourceUrl: '', content: '' });
    },
  });

  const updateBoxMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<OrbitBox> }) => {
      const response = await fetch(`/api/orbit/${businessSlug}/boxes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update box");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orbit-boxes", businessSlug] });
      setEditingBox(null);
    },
  });

  const deleteBoxMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/orbit/${businessSlug}/boxes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error("Failed to delete box");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orbit-boxes", businessSlug] });
    },
  });

  const toggleVisibility = (box: OrbitBox) => {
    updateBoxMutation.mutate({
      id: box.id,
      data: { isVisible: !box.isVisible },
    });
  };

  const boxes = boxesData?.boxes || [];

  if (planTier === 'free') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold text-white mb-1">Grid Curation</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Add and organize content boxes on your Orbit
        </p>
        <Card className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/20">
          <CardContent className="p-6 text-center">
            <Sparkles className="h-12 w-12 text-pink-400 mx-auto mb-4" />
            <h3 className="font-semibold text-white text-lg mb-2">Unlock Grid Curation</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Upgrade to Grow to add custom content boxes, testimonials, links, and more to your Orbit.
            </p>
            <Button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
              Upgrade to Grow
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-zinc-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-1" data-testid="text-grid-title">
            Grid Curation
          </h2>
          <p className="text-zinc-400 text-sm">
            Add and organize content boxes on your Orbit
          </p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          data-testid="button-add-box"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Box
        </Button>
      </div>

      {boxes.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800 border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-zinc-400" />
            </div>
            <h3 className="text-white font-medium mb-2">No boxes yet</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Add your first content box to start curating your Orbit grid.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setShowAddModal(true)}
              className="border-zinc-700 text-zinc-300 hover:text-white"
              data-testid="button-add-first-box"
            >
              Add Your First Box
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boxes.map((box) => {
            const Icon = boxTypeIcons[box.boxType as keyof typeof boxTypeIcons] || FileText;
            return (
              <Card 
                key={box.id} 
                className={cn(
                  "bg-zinc-900 border-zinc-800 group relative",
                  !box.isVisible && "opacity-50"
                )}
                data-testid={`card-box-${box.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg">
                      <Icon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 uppercase">
                          {boxTypeLabels[box.boxType as keyof typeof boxTypeLabels] || box.boxType}
                        </span>
                        {!box.isVisible && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <EyeOff className="h-3 w-3" />
                            Hidden
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-medium truncate" data-testid={`text-box-title-${box.id}`}>
                        {box.title}
                      </h3>
                      {box.description && (
                        <p className="text-zinc-400 text-sm truncate mt-1">
                          {box.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-white"
                        onClick={() => toggleVisibility(box)}
                        data-testid={`button-toggle-visibility-${box.id}`}
                      >
                        {box.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-white"
                        onClick={() => setEditingBox(box)}
                        data-testid={`button-edit-box-${box.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-red-400"
                        onClick={() => {
                          if (confirm('Delete this box?')) {
                            deleteBoxMutation.mutate(box.id);
                          }
                        }}
                        data-testid={`button-delete-box-${box.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Box</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new content box to your Orbit grid
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Box Type</label>
              <Select 
                value={newBox.boxType} 
                onValueChange={(v) => setNewBox({ ...newBox, boxType: v as keyof typeof boxTypeIcons })}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-box-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="url">Link</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="testimonial">Testimonial</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Title</label>
              <Input
                placeholder="Box title"
                value={newBox.title}
                onChange={(e) => setNewBox({ ...newBox, title: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                data-testid="input-box-title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Description (optional)</label>
              <Input
                placeholder="Brief description"
                value={newBox.description}
                onChange={(e) => setNewBox({ ...newBox, description: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                data-testid="input-box-description"
              />
            </div>
            {newBox.boxType === 'url' && (
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">URL</label>
                <Input
                  placeholder="https://..."
                  value={newBox.sourceUrl}
                  onChange={(e) => setNewBox({ ...newBox, sourceUrl: e.target.value })}
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="input-box-url"
                />
              </div>
            )}
            {(newBox.boxType === 'text' || newBox.boxType === 'testimonial') && (
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Content</label>
                <textarea
                  placeholder={newBox.boxType === 'testimonial' ? 'Customer testimonial...' : 'Your text content...'}
                  value={newBox.content}
                  onChange={(e) => setNewBox({ ...newBox, content: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm min-h-[100px] resize-none"
                  data-testid="input-box-content"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-zinc-700"
                onClick={() => setShowAddModal(false)}
                data-testid="button-cancel-add"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500"
                onClick={() => createBoxMutation.mutate(newBox)}
                disabled={!newBox.title || createBoxMutation.isPending}
                data-testid="button-confirm-add"
              >
                {createBoxMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Add Box'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBox} onOpenChange={() => setEditingBox(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Box</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update this content box
            </DialogDescription>
          </DialogHeader>
          {editingBox && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Title</label>
                <Input
                  value={editingBox.title}
                  onChange={(e) => setEditingBox({ ...editingBox, title: e.target.value })}
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="input-edit-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Description</label>
                <Input
                  value={editingBox.description || ''}
                  onChange={(e) => setEditingBox({ ...editingBox, description: e.target.value })}
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="input-edit-description"
                />
              </div>
              {editingBox.boxType === 'url' && (
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">URL</label>
                  <Input
                    value={editingBox.sourceUrl || ''}
                    onChange={(e) => setEditingBox({ ...editingBox, sourceUrl: e.target.value })}
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="input-edit-url"
                  />
                </div>
              )}
              {(editingBox.boxType === 'text' || editingBox.boxType === 'testimonial') && (
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Content</label>
                  <textarea
                    value={editingBox.content || ''}
                    onChange={(e) => setEditingBox({ ...editingBox, content: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm min-h-[100px] resize-none"
                    data-testid="input-edit-content"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700"
                  onClick={() => setEditingBox(null)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500"
                  onClick={() => updateBoxMutation.mutate({
                    id: editingBox.id,
                    data: {
                      title: editingBox.title,
                      description: editingBox.description,
                      sourceUrl: editingBox.sourceUrl,
                      content: editingBox.content,
                    },
                  })}
                  disabled={updateBoxMutation.isPending}
                  data-testid="button-confirm-edit"
                >
                  {updateBoxMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
