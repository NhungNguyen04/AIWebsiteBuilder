import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import { TreeItem } from "../types";
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TreeViewProps {
  data: TreeItem[];
  value?: string | null;
  onSelect?: (value: string) => void;
}

export const TreeView = ({ data, value, onSelect}: TreeViewProps) => {

  return (
    <SidebarProvider>
      <Sidebar collapsible="none">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {data.map((item, index) => (
                  <Tree
                    key={index}
                    item={item}
                    selectedValue={value}
                    onSelect={onSelect}
                    parentPath="" />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  )
}

interface TreeProps {
  item: TreeItem;
  selectedValue?: string | null;
  onSelect?: (value: string) => void;
  parentPath: string;
}

const Tree = ({ item, selectedValue, onSelect, parentPath }: TreeProps) => {

  const [name, ...items] = Array.isArray(item) ? item : [item];
  const currentPath = parentPath ? `${parentPath}/${name}` : name;

  if (!items.length) {

    // It's a file
    const isSelected = selectedValue === currentPath;

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isSelected}
          className="data-[active=true]:bg-transparent"
          onClick={() => onSelect?.(currentPath)}>
            <FileIcon />
            <span className="truncate">
              {name}
            </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  // It's a folder
  return (
    <SidebarMenuItem>
      <Collapsible
        defaultOpen>
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton className="group/trigger">
              <ChevronRightIcon className="transition-transform group-data-[state=open]/trigger:rotate-90"/>
              <FolderIcon />
              <span className="truncate">
                {name}
              </span>
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {items.map((subItem, index) => (
                <Tree
                  key={index}
                  item={subItem}
                  selectedValue={selectedValue}
                  onSelect={onSelect}
                  parentPath={currentPath} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}