// app/api/fragments/[fragmentId]/update-file/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/db";
import { Sandbox } from "@e2b/code-interpreter";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ fragmentId: string }> }
) {
  try {
    const { filePath, content } = await req.json();
    const { fragmentId } = await context.params;

    if (!filePath || content === undefined) {
      return NextResponse.json({ 
        error: 'Missing filePath or content' 
      }, { status: 400 });
    }

    const fragment = await prisma.fragment.findUnique({
      where: { id: fragmentId },
    });

    if (!fragment) {
      return NextResponse.json({ 
        error: 'Fragment not found' 
      }, { status: 404 });
    }

    const files = fragment.files as { [path: string]: string };
    
    // Update the specific file
    const updatedFiles = {
      ...files,
      [filePath]: content
    };

    // Try to update sandbox
    try {
      const sandboxId = fragment.sandboxUrl.split('//')[1].split('.')[0].split('-').slice(1).join('-');
      const sandbox = await Sandbox.reconnect(sandboxId);
      await sandbox.files.write(filePath, content);
      console.log('File updated in sandbox');
    } catch (sandboxError) {
      console.error('Sandbox error (continuing anyway):', sandboxError);
    }

    // Update database
    await prisma.fragment.update({
      where: { id: fragmentId },
      data: { files: updatedFiles }
    });

    return NextResponse.json({ 
      success: true,
      files: updatedFiles 
    });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json({ 
      error: 'Failed to update file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}