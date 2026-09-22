using Carpoolio.Api.Contracts;
using Carpoolio.Api.Domain;
using Xunit;

namespace Carpoolio.Api.Tests;

public class CarpoolRulesTests
{
    [Theory]
    [InlineData("900 00 000", "+4790000000")]
    [InlineData("+47 900 00 000", "+4790000000")]
    [InlineData("0047 900 00 000", "+4790000000")]
    public void NormalizePhone_ProducesE164(string input, string expected) =>
        Assert.Equal(expected, CarpoolRules.NormalizePhone(input));

    [Theory]
    [InlineData("")]
    [InlineData("12")]
    [InlineData("+123")]
    public void NormalizePhone_RejectsInvalidNumbers(string input) =>
        Assert.Null(CarpoolRules.NormalizePhone(input));

    [Fact]
    public void ValidateEvent_RejectsInvalidCalendarDate()
    {
        var error = CarpoolRules.Validate(new EventInput("Trip", "2026-02-30", null, null));
        Assert.Equal("Please pick a date.", error);
    }

    [Fact]
    public void ValidateCar_RejectsInvalidSeatCountAndTime()
    {
        Assert.NotNull(CarpoolRules.Validate(new CarInput(0, "Oslo", null, null)));
        Assert.Equal("Please pick a valid time.", CarpoolRules.Validate(new CarInput(2, "Oslo", "25:00", null)));
    }

    [Fact]
    public void NewShareCode_UsesSafeAlphabetAndExpectedLength()
    {
        var code = CarpoolRules.NewShareCode();
        Assert.Matches("^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$", code);
    }

    [Fact]
    public void Hash_IsDeterministicAndDoesNotReturnTheToken()
    {
        const string token = "session-token";
        Assert.Equal(CarpoolRules.Hash(token), CarpoolRules.Hash(token));
        Assert.NotEqual(token, CarpoolRules.Hash(token));
    }
}