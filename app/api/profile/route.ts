import { NextResponse } from "next/server";
import { createServerClientWithCookies } from "@/lib/supabaseClient";
import { getSession } from "@/lib/supabaseAuth";
import { upsertUser, UserProfile } from "@/lib/db-operations";

type ProfileUpdateFields = Pick<UserProfile, 'username' | 'avatar_url' | 'github_handle' | 'bio' | 'company' | 'location' | 'followers_count' | 'public_repos_count'>;

export async function PATCH(request: Request) {
  try {
    // Authenticate the user
    const supabase = await createServerClientWithCookies();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 },
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Parse request body
    const body = await request.json();
    const { 
      username, 
      avatar_url, 
      github_handle, 
      bio, 
      company, 
      location, 
      followers_count, 
      public_repos_count 
    } = body;

// Validate input - only allow fields that are safe to update per RLS
     const updates: Partial<ProfileUpdateFields> = {};
     
     if (username !== undefined) updates.username = username;
     if (avatar_url !== undefined) updates.avatar_url = avatar_url;
     if (github_handle !== undefined) updates.github_handle = github_handle;
     if (bio !== undefined) updates.bio = bio;
     if (company !== undefined) updates.company = company;
     if (location !== undefined) updates.location = location;
     if (followers_count !== undefined) updates.followers_count = followers_count;
     if (public_repos_count !== undefined) updates.public_repos_count = public_repos_count;

    // Update user profile
    const updatedUser = await upsertUser(
      {
        id: userId,
        ...updates
      },
      supabase
    );

    if (!updatedUser) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}