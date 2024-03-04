import { auth, clerkClient } from "@clerk/nextjs";
import type { User } from "@clerk/nextjs/server";
import { TRPCClientError } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  PrivateProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

// Creating a filter so that we don't return all the user data to the client
const filterUserForClient = (user: User) => {
  return {
    id: user.id,
    username: user.firstName,
    profilePicture: user.imageUrl,
  };
};

export const postRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.db.post.findMany({
      take: 100,
      orderBy: [{ createdAt: "desc" }],
    });

    const users = (
      await clerkClient.users.getUserList({
        userId: posts.map((post) => post.authorId),
        limit: 100,
      })
    ).map(filterUserForClient);

    return posts.map((post) => {
      const author = users.find((user) => user.id === post.authorId);

      if (!author)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Author for post not found",
        });

      return {
        post,
        author,
      };
    });
  }),

  create: PrivateProcedure.input(
    z.object({
      content: z.string().emoji().min(1).max(280),
    }),
  ).mutation(async ({ ctx, input }) => {
    const authorId = ctx.currentUser;

    const post = await ctx.db.post.create({
      data: {
        authorId,
        content: input.content,
      },
    });

    return post;
  }),
});
