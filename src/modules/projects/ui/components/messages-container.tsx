import { useTRPC } from "@/src/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { useEffect, useRef } from "react";
import { Fragment } from "@/generated/prisma";
import { MessageLoading } from "./message-loading";

interface ProjectProps {
    projectId: string;
    activeFragment: Fragment | null;
    setActiveFragment: (fragment: Fragment | null) => void;
}
export const MessagesContainer = ({ projectId, activeFragment, setActiveFragment }: ProjectProps) => {
    const trpc = useTRPC();
    const { data : messages } = useSuspenseQuery(trpc.messages.getMany.queryOptions({
        projectId: projectId,
    }, {
        //TODO: temporary live message update
        refetchInterval: 5000
    })) 
    const bottomRef = useRef<HTMLDivElement>(null);
    const lastAssistantMessageIdRef = useRef<string | null>(null);

    useEffect(() => {
        const lastAssistantMessage = messages.findLast(
            msg => msg.role === 'ASSISTANT');

        if (lastAssistantMessage?.fragment && lastAssistantMessage.id !== lastAssistantMessageIdRef.current) {
            setActiveFragment(lastAssistantMessage.fragment);
            lastAssistantMessageIdRef.current = lastAssistantMessage.id;
        }
    }, [messages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const lastMessage = messages?.[messages.length - 1];
    const isLastMessageUser = lastMessage?.role === 'USER';

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="pt-2 pr-1">
                    {messages?.map((message) => (
                        <MessageCard 
                            key={message.id}
                            content={message.content}
                            role={message.role}
                            fragment={message.fragment}
                            createdAt={message.createdAt}
                            isActiveFragment={activeFragment?.id === message.fragment?.id}
                            type={message.type}
                            onFragmentClick={() => setActiveFragment(message.fragment)}
                            attachments={message.attachments as Array<{
                                name: string;
                                type: string;
                                size: number;
                                url?: string;
                            }> | undefined}
                        />
                    ))}
                    {isLastMessageUser && <MessageLoading/>}
                    <div ref={bottomRef}/>
                </div>
            </div>
            <div className="relative p-3 pt-1">
                <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent
                to-background/70 pointer-events-none"></div>
                <MessageForm projectId={projectId} />
            </div>
        </div>
    )
}