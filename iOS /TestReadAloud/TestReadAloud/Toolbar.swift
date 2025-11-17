import SwiftUI

struct Toolbar: View {
    let onStart: (() -> Void)
    var body: some View {
        HStack {
            Spacer()
            Button(action: {
                onStart()
            }) {
                Text("Start")
            }
            .padding()
            Spacer()
        }
        .glassEffect()
    }
}

#Preview {
    VStack {
        Spacer()
        Toolbar(onStart: {

        })
        .padding(.horizontal)
    }
}
