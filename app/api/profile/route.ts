import { NextResponse } from "next/server";
import { createServerClientWithCookies, supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/session";
import { getFullProfile, upsertUser, UserProfile } from "@/lib/db-operations";

type ProfileUpdateFields = Pick<
  UserProfile,
  | 'username'
  | 'avatar_url'
  | 'github_handle'
  | 'bio'
  | 'location'
  | 'followers_count'
  | 'public_repos_count'
>;

export async function GET() {
  try {
    const supabase = await createServerClientWithCookies();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 },
      );
    }

    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbClient = supabaseAdmin ?? supabase;
    const profile = await getFullProfile(session.userId, dbClient);

    return NextResponse.json({
      success: true,
      profile,
      role: session.role,
    });
  } catch (error) {
    console.error("[GET /api/profile] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerClientWithCookies();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 },
      );
    }

    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.userId;
    const body = await request.json();
    const {
      username,
      avatar_url,
      github_handle,
      bio,
      location,
      followers_count,
      public_repos_count,
      company,
    } = body;

    const updates: Partial<ProfileUpdateFields> = {};

    if (username !== undefined) updates.username = username;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (github_handle !== undefined) updates.github_handle = github_handle;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    if (followers_count !== undefined) updates.followers_count = followers_count;
    if (public_repos_count !== undefined) updates.public_repos_count = public_repos_count;

    const dbClient = supabaseAdmin ?? supabase;

    // Update base user fields
    const updatedUser = await upsertUser(
      {
        id: userId,
        ...updates,
      },
      dbClient,
    );

    if (!updatedUser) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 },
      );
    }

    // If company was provided and admin client is available, update company
    if (company !== undefined && supabaseAdmin) {
      await supabaseAdmin
        .from("users")
        .update({ company: company ? company.trim() : null })
        .eq("id", userId);
    }

    const refreshedProfile = await getFullProfile(userId, dbClient);

    return NextResponse.json({
      success: true,
      user: refreshedProfile.user ?? updatedUser,
      profile: refreshedProfile,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}