/**
 * @file app/(workspace)/posts-comments/page.tsx
 *
 * Next.js route — minimal wrapper.
 * All logic and data fetching lives in PostsCommentsPage via usePostsComments hook.
 */

import { PostsCommentsPage } from "@/features/posts-comments/pages/posts-comments.page";

export default function Page() {
  return <PostsCommentsPage />;
}
