package example;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class AppTest {
    @Test
    void verifiesTheBuild() {
        assertEquals("gradle cache asset works", App.message());
    }
}
