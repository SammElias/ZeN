// Pure selection policy, shared by Windows observation and the no-Windows-access fixtures.
internal static class NowPlayingSelection
{
    internal static T? Pick<T>(IReadOnlyList<T> sessions, T? retained, T? current, Func<T, bool> playing, Func<T, string> identity) where T : class
    {
        // Retaining the same live session avoids jumping when multiple applications play at once.
        if (retained is not null && sessions.Contains(retained) && playing(retained)) return retained;
        if (current is not null && sessions.Contains(current) && playing(current)) return current;
        // Windows enumeration order breaks ties for two sessions from the same app.
        return sessions.Where(playing).OrderBy(identity, StringComparer.OrdinalIgnoreCase).FirstOrDefault();
    }

    internal static void VerifyFixtures()
    {
        var spotify = new Fixture("Spotify", true);
        var chrome = new Fixture("Chrome", true);
        var player = new Fixture("Video player", false);
        var all = new[] { spotify, chrome, player };
        Fixture? Pick(Fixture? retained, Fixture? current) => Pick<Fixture>(all, retained, current, s => s.Playing, s => s.Identity);
        void Assert(bool condition) { if (!condition) throw new InvalidOperationException("Now playing fixture failed."); }
        Assert(Pick(null, spotify) == spotify);
        Assert(Pick(chrome, spotify) == chrome);
        Assert(Pick(player, spotify) == spotify);
        Assert(Pick(null, player) == chrome);
        Assert(Pick(new Fixture("removed", true), spotify) == spotify);
        spotify.Playing = false;
        chrome.Playing = false;
        Assert(Pick(chrome, spotify) is null);
        player.Playing = true;
        Assert(Pick(chrome, spotify) == player);
        Console.WriteLine("Now playing fixtures passed: current, retained, stopped, removed, fallback, no playback, arbitrary app.");
    }

    private sealed class Fixture(string identity, bool playing)
    {
        internal string Identity { get; } = identity;
        internal bool Playing { get; set; } = playing;
    }
}
