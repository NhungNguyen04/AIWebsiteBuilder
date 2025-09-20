import prisma from '@/lib/db'
import React from 'react'

async function page() {

  const users = await prisma.user.findMany();
  return (
    <div>
      {JSON.stringify(users, null, 2)}
    </div>
  )
}

export default page
